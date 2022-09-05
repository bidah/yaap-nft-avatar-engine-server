import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as fs from "fs";
import { nanoid } from "nanoid";
import {
  updateDoc,
  writeBatch,
  limit,
  orderBy,
  addDoc,
  getFirestore,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  setDoc,
  doc,
} from "firebase/firestore/lite";
import { getStorage as getStorageAdmin } from "firebase-admin/storage";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import { initializeApp as initializeAppAdmin } from "firebase-admin/app";
import { getFirestore as getFirestoreAdmin } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import { mapSeries } from "awaity/esm";

//prettier-ignore
// @ts-ignore
import config from "../src/config";
import { redisConnection } from "../src/redisConfig";
import {firebaseConfig} from "./firebaseConfig";
const serviceAccount = fs
  .readFileSync(`${process.cwd()}/firebase/private_keys.json`)
  .toString();

// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// Initialize Firebase
let app;
let db;
let adminDb;
let storage;
let adminApp;
let adminAuth;

const deletePreviousCollection = async (userId) => {
  async function deleteCollection() {
    const batchSize = 100;
    const collectionRef = adminDb.collection(`${userId}/generator/schemas`);
    const collectionQuery = collectionRef.limit(batchSize);
    // const collectionQuery = query(collectionRef)

    return new Promise((resolve, reject) => {
      deleteQueryBatch(adminDb, collectionQuery, resolve).catch(reject);
    });
  }

  async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
      // When there are no documents left, we are done
      resolve();
      return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
      deleteQueryBatch(db, query, resolve);
    });
  }
  return deleteCollection();
};

export default {
  initializeApp: () => {
    app = initializeApp(firebaseConfig);
    adminApp = initializeAppAdmin({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
    // db = admin.database(app);
    adminDb = getFirestoreAdmin(adminApp);
    db = getFirestore(app);
    // storage = admin.storage(app);
    storage = getStorage(app);
    //prettier-ignore
    // @ts-ignore
    // adminApp = initializeAppAdmin({ credential: admin.credential.cert(JSON.parse(serviceAccount)) });
    adminAuth = getAuth(adminApp);
  },
  getAuthWithToken: (tokenId) => {
    // this will get back the userId to be used on following functions of admin that require userId
    return adminAuth.verifyIdToken(tokenId);
  },
  getAuthAdmin: () => {
    return adminAuth;
  },
  getAdminApp: () => {
    return adminApp;
  },
  setSneakPeak: async (projectId, userId, hash, notes) => {
    const docRef = adminDb.collection(userId).doc("projectSettingsSneakPeek");
    return docRef.update({
      [nanoid()]: {
        createdAt: new Date(),
        hash: hash.data.imageHash,
        notes: "",
      },
    });
  },
  setGeneratorNotification: async (value: boolean, userId: string) => {
    const docRef = adminDb.collection(userId).doc("generator");
    return docRef.update({ notEnoughLayersNotification: value });
  },
  setDeployedContract: async (projectId, userId, contractAddress) => {
    const docRef = adminDb.collection(userId).doc("blockchainSettings");
    return docRef.update({ contractAddress: contractAddress });
  },
  setAPIUrl: async (hashAPI, userId) => {
    const docRef = adminDb.collection(userId).doc("blockchainSettings");
    docRef.update({ hashAPI });
  },
  updateDeployStep: async (
    step: "apiGeneration" | "imageGeneration" | "contractGeneration",
    status: "not-started" | "processing" | "done",
    userId
  ) => {
    const docRef = adminDb.collection(userId).doc("generator");
    return docRef.update({ [step]: status });
  },
  addImageHashToSchema: async (docId, hash, userId) => {
    const docRef = adminDb
      .collection(`${userId}/generator/schemas/`)
      .doc(docId);
    return docRef.update({
      hash,
      image: "https://ipfs.io/ipfs/" + hash,
      isIPFSEnabled: true,
    });
  },
  getMetadata: async (userId) => {
    const schemasRef = adminDb.collection(`${userId}/generator/schemas/`);

    const schemas = await schemasRef.get();

    //@ts-ignore
    return schemas.docs.map((schema) => ({ ...schema.data(), id: schema.id }));
  },
  getLayers: async (userId) => {
    const core = adminDb.collection(userId);
    const doc = await core.get();
    // @ts-ignore
    const [coreRef] = doc.docs
      .map((doc) => doc.data())
      .filter((doc) => doc?.columns);

    let columns = Object.entries<any>(coreRef.columns).filter(
      (column) => column[1].layerIds.length
    );
    const layers = coreRef.layers;

    let growTo = 0;
    return Promise.all(
      columns.map(async (column, index) => {
        const [columnId, obj] = column;

        const layerItems = await query(
          collection(db, `${userId}/core/layerItems`),
          where("layerId", "array-contains-any", obj.layerIds)
        );

        const layerItemsSnapshot = await getDocs(layerItems);

        const layerItemsData = layerItemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as any;

        growTo = growTo + obj.editionAmount;
        console.log(`growTo ${obj.title}:`, growTo);
        return {
          growEditionSizeTo: growTo,
          layerData: {
            columnId,
            layers: obj.layerIds.map((layerId) => {
              return {
                layerId: layerId,
                layerName: layers[layerId].content,
                layerItems: layerItemsData
                  .filter((item) => item.layerId.includes(layerId))
                  .filter((item) => item.enabled),
              };
            }),
          },
        };
      })
    );
  },
  createCollectionTraitCount: async (userId, jsonSchemas) => {
    // const allSchemas = await adminDb
    //   .collection(`${userId}/generator/schemas`)
    //   .get();
    //
    // await mapSeries(jsonSchemas, async (jsonSchema) => {
    //   const docRef = schemasCollection.doc();
    //   return docRef.set(JSON.parse(jsonSchema));
    // });
    const obj = {};
    jsonSchemas
      .map((schema) => JSON.parse(schema))
      .map((item) => item.attributes)
      .flat()
      .map((item) => {
        if (item.trait_type in obj) {
          if (obj[item.trait_type][item.value]) {
            obj[item.trait_type][item.value] =
              obj[item.trait_type][item.value] + 1;
          } else {
            obj[item.trait_type][item.value] = 1;
          }
        } else {
          obj[item.trait_type] = {
            [item.value]: 1,
          };
        }
      });

    return adminDb
      .collection(`${userId}/generator/schemaStats`)
      .doc("collectionTraitCount")
      .set(obj, { merge: true });
  },
  uploadUniverse: async function uploadUniverse(userId) {
    if (config.onlyMetadataCreation) {
      await deletePreviousCollection(userId);
      console.log("deletePreviousCollection done");
      const schemasCollection = adminDb.collection(
        `${userId}/generator/schemas/`
      );
      const jsonSchemas = await redisConnection.lrange(userId, 0, -1);
      await this.createCollectionTraitCount(userId, jsonSchemas);
      await redisConnection.del(userId);
      await mapSeries(jsonSchemas, async (jsonSchema) => {
        const docRef = schemasCollection.doc();
        return docRef.set(JSON.parse(jsonSchema));
      });

      console.log("-------------------");
      console.log("uploadUniverse (individual schemas to firebase)  done");
      console.log("-------------------");
      return "ok";
    }
  },
};
