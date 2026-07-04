import mongoose, { Schema, model, models } from 'mongoose';

const LandingPageSchema = new Schema({
  promises: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    cta: {
        url: { type: String, required: true },
        label: { type: String, required: true }
    },
    imageUrl: { type: String, required: true } // URL Cloudinary
  }],
  values: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'Heart' }
  }],
  team: [{
    name: { type: String, required: true },
    role: { type: String, required: true },
    imageUrl: { type: String, required: true }, // URL Cloudinary
    bio: String
  }],
  aboutElmes: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    history: String,
    vision: String
  }
}, { timestamps: true });

export const LandingPage = models.LandingPage || model('LandingPage', LandingPageSchema);