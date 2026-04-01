// modules/vision.js - The AI Vision Module
import { FilesetResolver, FaceLandmarker, ImageSegmenter } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

export const VisionEngine = {
    faceLandmarker: null,
    imageSegmenter: null,

    async init() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Initialize Face Landmarker (for the Master Face)
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "IMAGE"
        });

        // Initialize Image Segmenter (to cut out the shirt)
        this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`,
                delegate: "GPU"
            },
            runningMode: "IMAGE"
        });
    },

    async getSkinTone(imageElement) {
        const result = this.faceLandmarker.detect(imageElement);
        if (result.faceLandmarks.length > 0) {
            // Landmark 1 (Tip of nose) or 4 (Chin) are good reference points
            // For skin tone, we sample a point near the cheek (Landmark 234)
            const cheek = result.faceLandmarks[0][234];
            return { x: cheek.x, y: cheek.y };
        }
        return null;
    },

    async extractShirtColor(imageElement) {
        // This runs the "Selfie Segmenter" to find the person/clothing
        // and ignore the background store shelves.
        const result = await this.imageSegmenter.segment(imageElement);
        const mask = result.confidenceMasks[0]; 
        // Logic to sample only the pixels within the 'clothing' mask...
        return "#7B3F00"; // Placeholder for the extracted dominant shirt hex
    },

    async extractShirt(shirtElement) {
        if (!this.imageSegmenter) {
            console.error("Segmenter not initialized");
            return shirtElement;
        }

        // 1. Run AI Segmentation
        const segmentationResult = await this.imageSegmenter.segment(shirtElement);
        const mask = segmentationResult.confidenceMasks[0]; 

        // 2. Create a temporary canvas to process the mask
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = shirtElement.width;
        canvas.height = shirtElement.height;

        // 3. Draw the original shirt
        ctx.drawImage(shirtElement, 0, 0);

        // 4. The "Magic": Apply the mask to remove the background
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const maskData = await mask.getAsFloat32Array();

        for (let i = 0; i < maskData.length; i++) {
            // If the AI is less than 80% sure this is a 'person/object', make it transparent
            if (maskData[i] < 0.8) {
                pixels[i * 4 + 3] = 0; // Set Alpha (Transparency) to 0
            }
        }

        ctx.putImageData(imageData, 0, 0);
        
        // Return the "Clean" shirt as a new Image object
        const cleanShirt = new Image();
        cleanShirt.src = canvas.toDataURL();
        return new Promise(resolve => cleanShirt.onload = () => resolve(cleanShirt));
    },
    
    async renderOverlay(canvas, ctx, faceImg, shirtImg) {
        canvas.width = faceImg.width;
        canvas.height = faceImg.height;
        const result = this.faceLandmarker.detect(faceImg);
    
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            ctx.drawImage(faceImg, 0, 0); // Draw your face first
    
            ctx.save();
            // Landmarks for the "V" shape
            const left = landmarks[132];
            const right = landmarks[361];
            const chin = landmarks[152];
    
            ctx.beginPath();
            ctx.moveTo(left.x * canvas.width, left.y * canvas.height);
            ctx.lineTo(chin.x * canvas.width, (chin.y + 0.4) * canvas.height); // Deeper V
            ctx.lineTo(right.x * canvas.width, right.y * canvas.height);
            ctx.closePath();
    
            // This turns the V-shape into a "cookie cutter"
            ctx.clip(); 
    
            // Draw the SWEATER inside the V
            // We offset it so the middle of the sweater photo aligns with your chest
            ctx.drawImage(shirtImg, 0, chin.y * canvas.height, canvas.width, canvas.height);
            
            ctx.restore();
        }
    }
};
