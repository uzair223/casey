declare module "docxtemplater-image-module-free" {
  type ImageModuleOptions = {
    centered?: boolean;
    getImage: (tagValue: unknown, tagName: string) => unknown;
    getSize: (
      img: unknown,
      tagValue: unknown,
      tagName: string,
    ) => [number, number];
  };

  export default class ImageModule {
    constructor(options: ImageModuleOptions);
  }
}
