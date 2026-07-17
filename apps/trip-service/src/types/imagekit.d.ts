/**
 * Déclaration minimale pour le SDK ImageKit (pas de types officiels).
 * Suffisant pour lib/imagekit.ts et upload.controller.ts.
 */
declare module "imagekit" {
  interface ImageKitOptions {
    publicKey: string;
    privateKey: string;
    urlEndpoint: string;
  }
  interface AuthenticationParameters {
    token: string;
    expire: number;
    signature: string;
  }
  export default class ImageKit {
    constructor(options: ImageKitOptions);
    getAuthenticationParameters(token?: string, expire?: number): AuthenticationParameters;
    deleteFile(fileId: string): Promise<void>;
  }
}
