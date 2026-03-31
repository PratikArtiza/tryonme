// modules/storage.js
const db = new Dexie("VibeCheckDB");
db.version(1).stores({
    profile: "id, imageData, skinHex"
});

export const ProfileStorage = {
    async saveMasterFace(blob, hex) {
        return await db.profile.put({
            id: "master",
            imageData: blob,
            skinHex: hex,
            updatedAt: Date.now()
        });
    },

    async getMasterFace() {
        return await db.profile.get("master");
    }
};
