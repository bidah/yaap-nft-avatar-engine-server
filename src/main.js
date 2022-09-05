import * as path from "path";
const basePath = process.env.PWD; //path.join(__dirname);
import * as fs from "fs";
import sha1 from "sha1";
import { createCanvas, loadImage } from "canvas";
import * as R from "ramda";
import Moralis, { nftStorage } from "./moralisConfig";
import { Blob } from "nft.storage";
import * as _firebase from "firebase/firestore";

import {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  // layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  onlyMetadataCreation,
} from "./config";
import { redisConnection } from "./redisConfig";

const setup = ({ userId, firebase }) => {
  const buildDir = path.join(basePath, "/build/" + userId);
  let canvas = createCanvas(format.width, format.height);
  const ctx = canvas.getContext("2d");
  var metadataList = [];
  var attributesList = [];
  var dnaList = [];
  var userId = userId;

  const cleanDna = (_str) => {
    return Number(_str.split(":").shift());
  };

  const cleanName = (_str) => {
    let nameWithoutExtension = (_str) => _str.slice(0, -4);
    return nameWithoutExtension(_str);
  };

  const getElements = (path, { withJson = false } = {}) => {
    let images = fs
      .readdirSync(path)
      // remove hidden files
      .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
      .map((i, index) => {
        return {
          id: index,
          name: cleanName(i),
          filename: i,
          path: `${path}${i}`,
          // weight: getRarityWeight(i),
          weight: 20,
        };
      });

    if (withJson) {
    }
  };

  const getRarityWeight = (rarity) => {
    // note: of a total of 100
    // lightest the rarest
    // TODO: setup rarity on the frontend
    const RarityTypeValues = {
      "Super Rare": 5,
      Rare: 10,
      Uncommon: 35,
      Common: 50,
    };
    return RarityTypeValues[rarity];
  };

  const layersSetup = (layerData) => {
    const layers = layerData.map((layerObj, index) => {
      return {
        ...layerObj,
        id: index,
        layerItems: layerObj.layerItems.map((item, index) => ({
          ...item,
          id: index,
          layerItemId: item.id,
          weight: getRarityWeight(item.rarity),
        })),
      };
    });
    return layers;
  };

  const saveImage = (_editionCount) => {
    fs.writeFileSync(
      `${buildDir}/images/${_editionCount}.png`,
      canvas.toBuffer("image/png")
    );
  };

  const addMetadata = (_dna, _edition, columnId = 0, results) => {
    //create version for final generator (without dnaAsUrl and dnaRaw)
    let dateTime = Date.now();
    let tempMetadata = {
      columnId,
      dna: sha1(_dna.join("")),
      dnaRaw: _dna,
      name: `#${_edition}`,
      description: description,
      image: ``,
      hash: "",
      isIPFSEnabled: false,
      edition: _edition,
      date: dateTime,
      ...extraMetadata,
      attributes: attributesList,
      dnaAsURL: results.map((item) => ({
        selectedElement: {
          image: item.selectedElement.image,
        },
      })),
      createdAt: _firebase.Timestamp.now(),
    };
    metadataList.push(tempMetadata);
    attributesList = [];
  };

  const addAttributes = (_element) => {
    let selectedElement = _element.layer.selectedElement;
    attributesList.push({
      trait_type: _element.layer.name,
      value: selectedElement.name,
    });
  };

  const loadLayerImg = async (_layer) => {
    return new Promise(async (resolve) => {
      //TODO: change previewImage to original for deploy
      const image = await loadImage(_layer.selectedElement.previewImage);
      resolve({ layer: _layer, loadedImage: image });
    });
  };

  const drawElement = (_renderObject, { onlyAddAttributes = false }) => {
    if (onlyAddAttributes) {
      return addAttributes(_renderObject);
    }
    ctx.globalAlpha = _renderObject.layer.opacity;
    ctx.globalCompositeOperation = _renderObject.layer.blendMode;
    ctx.drawImage(_renderObject.loadedImage, 0, 0, format.width, format.height);
    addAttributes(_renderObject);
  };

  const constructLayerToDna = (_dna = [], _layers = []) => {
    let mappedDnaToLayers = _layers.map((layer, index) => {
      let selectedElement = layer.layerItems.find(
        (e) => e.id == cleanDna(_dna[index])
      );

      return {
        name: layer.layerName,
        selectedElement: selectedElement,
      };
    });
    return mappedDnaToLayers;
  };

  const isDnaUnique = (_DnaList = [], _dna = []) => {
    let foundDna = _DnaList.find((i) => i.join("") === _dna.join(""));
    return foundDna == undefined ? true : false;
  };

  const createDna = (_layers) => {
    let randNum = [];
    _layers.forEach((layer) => {
      let totalWeight = 0;
      layer.layerItems.forEach((layerItem) => {
        totalWeight += layerItem.weight;
      });
      // number between 0 - totalWeight
      let random = Math.floor(Math.random() * totalWeight);
      for (var i = 0; i < layer.layerItems.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        random -= layer.layerItems[i].weight;
        if (random < 0) {
          return randNum.push(
            `${layer.layerItems[i].id}:${layer.layerItems[i].filename}`
          );
        }
      }
    });
    return randNum;
  };

  const saveMetaDataSingleFile = async (userId, _editionCount) => {
    let metadata = metadataList.find((meta) => meta.edition == _editionCount);
    return redisConnection.lpush(userId, JSON.stringify(metadata, null, 2));
  };

  function shuffle(array) {
    let currentIndex = array.length,
      randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }
    return array;
  }

  const startCreatingFromMetadata = async (workQueue, userId, type) => {
    const metadata = await firebase.getMetadata(userId);

    /**
     * Create / Connect to a named work queue
     */

    // TODO: iterate on each metadata object of array and add to work queue
    // 1. when job done save image to firebase with userId+projectId.
    // 2. when all jobs done update schema file with ipfs images hash and api
    // 3. after that push to the folder the array of schemas.
    // await Promise.all(R.slice(0, 2, metadata).map((metadataItem) => workQueue.add("image-job", {metadataItem, userId} )))
    if (type === "api") {
      await workQueue.add("api-job", { metadata, userId });
    } else {
      await Promise.all(
        metadata.map((metadataItem) =>
          workQueue.add("image-job", { metadataItem, userId })
        )
      );
    }
  };

  const startCreating = async (workQueue) => {
    let layerConfigurations = await firebase.getLayers(userId);
    layerConfigurations = layerConfigurations.sort(
      (item, item2) => item.growEditionSizeTo - item2.growEditionSizeTo
    );

    let layerConfigIndex = 0;
    let editionCount = 1;
    let failedCount = 0;
    let abstractedIndexes = [];
    for (
      let i = 1;
      i <=
      layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
      i++
    ) {
      abstractedIndexes.push(i);
    }

    //TODO: user config obj
    // if (shuffleLayerConfigurations) {
    //   // if (true) {
    //   abstractedIndexes = shuffle(abstractedIndexes);
    // }

    while (layerConfigIndex < layerConfigurations.length) {
      const layers = layersSetup(
        layerConfigurations[layerConfigIndex].layerData.layers
      );
      while (
        editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
      ) {
        let newDna = createDna(layers);
        if (isDnaUnique(dnaList, newDna)) {
          let results = constructLayerToDna(newDna, layers);
          let loadedElements = [];

          if (onlyMetadataCreation) {
            results.forEach((layer) => {
              loadedElements.push({ layer: layer, loadedImage: "" });
            });

            const addAttributes = (_element) => {
              let selectedElement = _element.layer.selectedElement;
              attributesList.push({
                trait_type: _element.layer.name,
                value: selectedElement.name,
                id: selectedElement.layerItemId,
              });
            };
            loadedElements.map(addAttributes);

            addMetadata(
              newDna,
              abstractedIndexes[0],
              layerConfigurations[layerConfigIndex].layerData.columnId,
              results
            );
            //TODO: not needed anymore. stored on firebase now
            await saveMetaDataSingleFile(userId, abstractedIndexes[0]);
            console.log(
              `Created edition: ${abstractedIndexes[0]}, with DNA: ${sha1(
                newDna.join("")
              )}`
            );
          }
          //------------------

          dnaList.push(newDna);
          editionCount++;
          abstractedIndexes.shift();
        } else {
          console.log("DNA exists!");
          failedCount++;
          if (failedCount >= uniqueDnaTorrance) {
            // TODO: ON firebase generator collection add this message (to show on UI)
            await firebase.setGeneratorNotification(true, userId);
            console.log(
              `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
            );
            break;
            // process.exit();
          }
        }
      }
      layerConfigIndex++;
    }
    // writeMetaData(JSON.stringify(metadataList, null, 2));
    console.log("before upload-universe-job");
    await workQueue.add("upload-universe-job", userId);
    if (!(failedCount >= uniqueDnaTorrance)) {
      await firebase.setGeneratorNotification(false, userId);
    }
    return metadataList;
  };

  return { startCreating, getElements, startCreatingFromMetadata };
};

let moralisAbi = [];

const metadataSchemaToIPFS = async () => {
  const metadata = await firebase.getMetadata(userId);
  const metadataSchemaRes = await Moralis.Web3API.storage.uploadFolder({
    abi: metadata.map((md) => md.schema),
  });

  // TODO: save metadataSchemaRes API url on user account
  // await firebase.saveSchemaURL(metadataSchemaRes)
  return metadataSchemaRes;
};

const metadataItemToImage = async (
  metadataItem,
  { isPreviewImage = false } = {}
) => {
  const format = {
    width: 1000,
    height: 1000,
  };
  let canvas = createCanvas(
    isPreviewImage ? 200 : format.width,
    isPreviewImage ? 200 : format.height
  );
  const ctx = canvas.getContext("2d");

  if (R.isNil(metadataItem?.dnaAsURL)) return "";
  const loadedLayers = metadataItem?.dnaAsURL?.map((renderObject) => {
    return loadImage(renderObject.selectedElement.image);
  });

  const loadedLayersResolved = await Promise.allSettled(loadedLayers);

  loadedLayersResolved
    .filter((i) => i.status === "fulfilled")
    .map((i) => i.value)
    .forEach((img) => {
      ctx.globalAlpha = 1;
      ctx.drawImage(
        img,
        0,
        0,
        isPreviewImage ? 200 : format.width,
        isPreviewImage ? 200 : format.height
      );
    });
  let bufferImage = canvas.toBuffer("image/png");

  const blobImage = new Blob([bufferImage], { type: "image/png" });
  console.log("before saving to nft.storage");
  const imageHash = await nftStorage.storeBlob(blobImage);
  console.log("https://ipfs.io/ipfs/" + imageHash);
  ctx.clearRect(0, 0, 0, 0);
  canvas = null;
  return imageHash;
};

export { setup, metadataItemToImage, metadataSchemaToIPFS };
