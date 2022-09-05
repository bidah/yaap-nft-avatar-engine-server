export const description =
  "Neo jungle world from the creative hand and mind of Pablolt";

export const baseUri =
  "http://1579ee2e-e4b4-4bd2-8ce9-30e445f1bc04.ngrok.io/images";

export const shuffleLayerConfigurations = false;
export const debugLogs = true;

export const format = {
  preview: {
    width: 200,
    height: 200,
  },
  original: {
    width: 5000,
    height: 5000,
  },
};

export const background = {
  generate: false,
  brightness: "80%",
};

export const extraMetadata = {};

export const uniqueDnaTorrance = 10000;

export const onlyMetadataCreation = true;

export const preview = {
  thumbPerRow: 5,
  thumbWidth: format.preview.width,
  imageRatio: format.preview.width / format.preview.height,
  imageName: "preview.png",
};

//TODO: this should come from firestore user generatorConfig
export default {
  format: format.preview,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  preview,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  onlyMetadataCreation,
};
