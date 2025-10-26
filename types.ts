
export enum PhotoStyle {
  RusticDark = 'Rustic/Dark',
  BrightModern = 'Bright/Modern',
  SocialMedia = 'Social Media',
}

export interface Dish {
  id: string;
  name: string;
  imagePrompt: string;
  originalImage: string; // base64
  editedImage?: string; // base64
  isGenerating: boolean;
  isEditing: boolean;
  error?: string;
  mimeType: string;
}
