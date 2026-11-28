import {
  defineWaClientPlugin,
  normalizeDeviceJid,
  parseSignalAddressFromJid,
  proto,
  writeRandomPadMax16,
} from "zapo-js";

const ENC_VERSION = "2";
const ID_PREFIX = "3EB0";
const MESSAGE_TYPE = "text";

const createStanzaId = () => {
  const bytes = new Uint8Array(9);

  crypto.getRandomValues(bytes);

  return ID_PREFIX + [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
};

const createMutex = () => {
  let tail = Promise.resolve();

  return (task) => {
    const run = tail.then(task);

    tail = run.catch(() => {});

    return run;
  };
};

const toEncNode = (encType, ciphertext, extraAttrs = {}) => ({
  tag: "enc",
  attrs: {
    v: ENC_VERSION,
    type: encType,
    ...extraAttrs,
  },
  content: ciphertext,
});

const toParticipantNode = ({ jid, encType, ciphertext }) => ({
  tag: "to",
  attrs: { jid },
  content: [toEncNode(encType, ciphertext)],
});

export const selectiveGroupSend = defineWaClientPlugin({
  id: "selective-group-send",
  exposeAs: "selective",

  setup: (ctx) => {
    const { senderKeyManager, signalProtocol, sessionResolver, signalDeviceSync } = ctx.deps;

    const senderKeyStore = ctx.stores.senderKey;
    const lock = createMutex();

    const requireCredentials = () => {
      const credentials = ctx.client.getCredentials();

      if (!credentials?.meJid) {
        throw new Error("selective: client is not registered");
      }

      return credentials;
    };

    const resolveSelfDeviceJid = (addressingMode) => {
      const { meJid, meLid } = requireCredentials();
      const useLid = addressingMode === "lid" && meLid?.includes("@");

      return normalizeDeviceJid(useLid ? meLid : meJid);
    };

    const resolveRecipientDevices = async (recipientJids, selfDeviceJid, includeOwnDevices) => {
      const users = [...new Set(recipientJids)];

      if (includeOwnDevices) {
        users.push(selfDeviceJid.replace(/:\d+(?=@)/, ""));
      }

      const synced = await signalDeviceSync.syncDeviceList(users);
      const devices = new Set();

      for (const { jid, deviceJids } of synced) {
        for (const deviceJid of deviceJids.length ? deviceJids : [jid]) {
          const normalized = normalizeDeviceJid(deviceJid);

          if (normalized !== selfDeviceJid) {
            devices.add(normalized);
          }
        }
      }

      return [...devices];
    };

    const encryptDistribution = async (distributionMessage, deviceJids) => {
      const targets = await sessionResolver.ensureSessionsBatch(deviceJids);

      if (!targets.length) {
        throw new Error("selective: no signal session for the recipient devices");
      }

      const payload = await writeRandomPadMax16(
        proto.Message.encode({ senderKeyDistributionMessage: distributionMessage }).finish(),
      );

      const encrypted = await signalProtocol.encryptMessagesBatch(
        targets.map(({ address }) => ({ address, plaintext: payload })),
        targets.map(({ address, session }) => ({ address, session })),
      );

      return targets.map(({ jid, address }, index) => ({
        jid,
        address,
        encType: encrypted[index].type,
        ciphertext: encrypted[index].ciphertext,
      }));
    };

    const buildDeviceIdentityNode = () => {
      const { signedIdentity } = requireCredentials();

      if (!signedIdentity) return [];

      return [
        {
          tag: "device-identity",
          attrs: {},
          content: proto.ADVSignedDeviceIdentity.encode(signedIdentity).finish(),
        },
      ];
    };

    const buildNode = async ({
      groupJid,
      recipientJids,
      message,
      addressingMode,
      includeOwnDevices = false,
      edit,
      id = createStanzaId(),
    }) => {
      if (!recipientJids?.length) {
        throw new Error("selective: recipientJids is empty");
      }

      const selfDeviceJid = resolveSelfDeviceJid(addressingMode);
      const sender = parseSignalAddressFromJid(selfDeviceJid);

      await senderKeyStore.deleteDeviceSenderKey(sender, groupJid);

      const plaintext = await writeRandomPadMax16(proto.Message.encode(message).finish());

      const { distributionMessage, ciphertext, keyId } =
        await senderKeyManager.prepareGroupEncryption(groupJid, sender, plaintext);
      const deviceJids = await resolveRecipientDevices(
        recipientJids,
        selfDeviceJid,
        includeOwnDevices,
      );

      if (!deviceJids.length) {
        throw new Error("selective: no recipient devices found");
      }

      const participants = await encryptDistribution(distributionMessage, deviceJids);
      const needsIdentity = participants.some(({ encType }) => encType === "pkmsg");

      const node = {
        tag: "message",
        attrs: {
          to: groupJid,
          type: MESSAGE_TYPE,
          id,
          ...(addressingMode ? { addressing_mode: addressingMode } : {}),
          ...(edit ? { edit } : {}),
        },
        content: [
          {
            tag: "participants",
            attrs: {},
            content: participants.map(toParticipantNode),
          },
          toEncNode("skmsg", ciphertext.ciphertext, { "decrypt-fail": "hide" }),
          ...(needsIdentity ? buildDeviceIdentityNode() : []),
        ],
      };

      const markDistributed = () =>
        senderKeyManager.markSenderKeyDistributed(
          groupJid,
          keyId,
          participants.map(({ address }) => address),
        );

      return {
        node,
        id,
        keyId,
        devices: participants.map(({ jid }) => jid),
        markDistributed,
      };
    };

    const send = (input) =>
      lock(async () => {
        const { node, id, keyId, devices, markDistributed } = await buildNode(input);

        await ctx.client.lowlevel.sendNode(node);
        await markDistributed();

        return { id, keyId, devices };
      });

    return {
      buildNode: (input) => lock(() => buildNode(input)),
      send,
    };
  },
});
