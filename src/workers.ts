import {Queue, Worker} from "bullmq";
import firebase from "../firebase";
import Moralis from "moralis/node";
import * as R from "ramda";
import axios from "axios";
import {redisConnection} from "../src/redisConfig";

export let workQueue = new Queue("ee32", {
    connection: redisConnection,
});

workQueue.on("completed", function (job, result) {
    console.log("Completed: Job-" + job.id);
});

workQueue.on("failed", async function (job, error) {
    console.log("Failed: Job-" + job.id);
});

const worker = new Worker(
    "ee32",
    async (job) => {
        console.log("@ worker");
        // job.discard();
        // job.moveToFailed();
        try {
            if (job.name === "upload-universe-job") {
                console.log("upload-universe-job started");
                const userId = job.data;
                await firebase.uploadUniverse(userId);
                console.log("upload-universe-job done");
                return;
            }

            if (job.name === "api-job") {
                console.log("api-job started");
                const userId = job.data.userId;
                // remove internal schema props
                const metadata = job.data.metadata.map((metadata) => {
                    delete metadata.dnaAsURL;
                    delete metadata.dnaRaw;
                    delete metadata.isIPFSEnabled;
                    delete metadata.columnId;
                    delete metadata.id;
                    delete metadata.createdAt;
                    delete metadata.date;
                    return metadata;
                });
                let moralisABI = metadata.map((metadata) => ({
                    path: metadata.edition + ".json",
                    content: metadata,
                }));

                //@ts-ignore
                const ipfsRes = await Moralis.Web3API.storage.uploadFolder({
                    abi: JSON.stringify(moralisABI),
                });
                console.log("ipfsRes", ipfsRes);
                const hashAPI = R.match(/ipfs\/.+\//, ipfsRes[0].path)[0]
                    .substring(5)
                    .slice(0, -1);
                await firebase.setAPIUrl(hashAPI, userId);
                await firebase.updateDeployStep("apiGeneration", "done", userId);
                return;
            }

            if (job.name === "image-job") {
                console.log("image-job started");
                const imageHash = await axios
                    .post(process.env.IMAGE_GENERATION_URL || "", {
                        metadataItem: job.data.metadataItem,
                        isPreviewImage: false,
                    })
                    .then((res) => res.data.imageHash);

                console.log("imageHash", imageHash);

                await firebase
                    .addImageHashToSchema(
                        job.data?.metadataItem?.id,
                        imageHash,
                        job.data?.userId
                    )
                    .then((res) => console.log(res))
                    .catch((e) => console.error(e));
                return "job done";
            }
            //image generation job
        } catch (e) {
            console.log(e);
        }
    },
    { concurrency: 10, connection: redisConnection }
);

worker.on("completed", async (job) => {
    console.log(`Job completed with result ${job.id} - ${job.name}`);
});

