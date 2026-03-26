/**
 * ImageGenerator — Scene visualization using Pollinations.ai
 * Free, no API key required
 */

export class ImageGenerator {
  constructor() {
    this.currentUrl = null;
    this.isLoading = false;
  }

  /**
   * Generate a scene image from a description
   * Uses Pollinations.ai free API
   */
  generateSceneUrl(description) {
    // Enhance the prompt for better fantasy art
    const enhancedPrompt = `${description}, digital fantasy art, highly detailed, dramatic lighting, D&D style, epic atmosphere, 4K quality`;
    
    // Pollinations.ai generates images via URL
    const encoded = encodeURIComponent(enhancedPrompt);
    const seed = Math.floor(Math.random() * 99999);
    this.currentUrl = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=480&seed=${seed}&nologo=true`;
    
    return this.currentUrl;
  }

  /**
   * Load image with loading state management
   */
  async loadImage(description) {
    this.isLoading = true;
    const url = this.generateSceneUrl(description);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.isLoading = false;
        resolve(url);
      };
      img.onerror = () => {
        this.isLoading = false;
        resolve(null);
      };
      img.src = url;
      
      // Timeout after 15 seconds
      setTimeout(() => {
        if (this.isLoading) {
          this.isLoading = false;
          resolve(url); // Still return URL, browser may load it later
        }
      }, 15000);
    });
  }
}
