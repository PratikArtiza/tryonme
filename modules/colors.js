// modules/colors.js
export const ColorEngine = {
    // Convert Hex to HSP for perceived brightness
    getPerceivedBrightness(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        // HSP Equation for human eye sensitivity
        return Math.sqrt(0.299 * (r**2) + 0.587 * (g**2) + 0.114 * (b**2));
    },

    analyzeHarmony(skinHex, shirtHex) {
        const skinB = this.getPerceivedBrightness(skinHex);
        const shirtB = this.getPerceivedBrightness(shirtHex);
        const diff = Math.abs(skinB - shirtB);

        if (diff > 120) return { verdict: "Perfect Match", class: "high-contrast" };
        if (diff > 60) return { verdict: "Harmonious", class: "medium-contrast" };
        return { verdict: "Might Wash Out", class: "low-contrast" };
    }
};
