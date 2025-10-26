
import { PhotoStyle } from './types';

export const APP_TITLE = 'Virtual Food Photographer';
export const APP_DESCRIPTION = 'Turn your menu into a masterpiece. Generate stunning, professional photos for every dish.';

export const STYLE_CONFIG = {
  [PhotoStyle.RusticDark]: {
    aspectRatio: '4:3',
    promptHint: 'moody lighting, dark wood background, cast iron skillet, fresh herbs, slightly messy, artisanal feel, dramatic shadows, warm tones'
  },
  [PhotoStyle.BrightModern]: {
    aspectRatio: '1:1',
    promptHint: 'bright, natural light, minimalist white plate, clean background, vibrant colors, precise plating, high-key photography, airy feel'
  },
  [PhotoStyle.SocialMedia]: {
    aspectRatio: '9:16',
    promptHint: 'top-down flat lay, colorful background, props like cutlery and napkins, perfect for Instagram, engaging composition, lifestyle feel'
  }
};

export const MENU_PARSING_MODEL = 'gemini-2.5-flash';
export const IMAGE_GENERATION_MODEL = 'imagen-4.0-generate-001';
export const IMAGE_EDITING_MODEL = 'gemini-2.5-flash-image';
