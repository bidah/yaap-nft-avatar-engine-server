// @ts-nocheck
require('dotenv').config()
import './redisConfig'
import express, { Application, Request, Response, NextFunction } from "express";
import {workQueue} from './workers'
import cors from "cors";
import bodyParser from "body-parser";
import firebase from "../firebase/index";
import { setup } from "./main";
import axios from "axios";
import { useAuthWithToken } from "./middleware";

// Serve on PORT on Heroku and on localhost:3001 locally
let PORT = process.env.PORT || "3001";

firebase.initializeApp();

const app: Application = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// enable cors
app.use(cors());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/access", (req: Request, res: Response) => {
  console.log(req?.query?.code);
  if (req?.query?.code) {
    if (req?.query?.code === "eab2d726-9329-11ec-b909-0242ac120002") {
      res.status(200).json({ status: "access" });
    } else {
      res.status(200).json({ status: "no-access" });
    }
  } else {
    res.status(200).json({ status: "no-access" });
  }
});

app.post("/create-sneak-peek", async (req: Request, res: Response) => {
  try {
    const { uid, schema, projectId } = req.body ?? {};

    const hash = await axios.post(process.env["IMAGE_GENERATION_URL "], {
      metadataItem: schema,
      isPreviewImage: true,
    });

    await firebase.setSneakPeak("", uid, hash, "").catch((e) => console.log(e));
    res.status(200).json({ status: true });
  } catch (e) {
    console.error(e);
    res.status(404);
  }
});

/**
 * Saves information of new user contract after listening to factory contract event
 */
app.post("/new-factory-contract", async (req: Request, res: Response) => {
  console.log("@ /new-factory-contract");
  const { uid, nft, projectId } = req.body ?? {};
  await firebase.setDeployedContract(projectId, uid, nft);
  await firebase.updateDeployStep("contractGeneration", "done", uid);
});

app.get("/login", async (req: Request, res: Response) => {
  const userId = req?.query?.userId;
  firebase
    .getAuthAdmin()
    .createCustomToken(userId)
    .then((token) => {
      return res.json({ token });
    })
    .catch((error) => {
      console.error(error);
      return res.json({ error });
    });
});

app.get("/generate", useAuthWithToken, async (req: Request, res: Response) => {
  console.log("req.authWithToken.userId", req.authWithToken.user_id);
  try {
    let { startCreating } = setup({
      userId: req.authWithToken.user_id,
      firebase: firebase,
    });
    console.log("build setup done");
    await startCreating(workQueue).catch((e) => console.error(e));
    res.status(200).json({ status: true });
  } catch (e) {
    console.error(e);
    res.json({ status: "error", msg: e });
  }
});

app.get(
  "/generate/deploy-images",
  useAuthWithToken,
  async (req: Request, res: Response) => {
    let { startCreatingFromMetadata } = setup({
      userId: req.authWithToken.user_id,
      firebase,
    });
    await startCreatingFromMetadata(workQueue, req.query.userId).catch((e) =>
      console.error(e)
    );
    await firebase.updateDeployStep(
      "imageGeneration",
      "processing",
      req.query.userId
    );
    res.status(200).json({ status: true });
  }
);

app.get(
  "/generate/deploy-api",
  useAuthWithToken,
  async (req: Request, res: Response) => {
    console.log("@ /generate/deploy-api");
    let { startCreatingFromMetadata } = setup({
      userId: req.authWithToken.user_id,
      firebase,
    });
    await startCreatingFromMetadata(workQueue, req.query.userId, "api").catch(
      (e) => console.error(e)
    );
    await firebase.updateDeployStep(
      "apiGeneration",
      "processing",
      req.query.userId
    );
    res.status(200).json({ status: true });
  }
);

// TODO: Allow the client to query the state of a background job
// app.get('/job/:id', async (req, res) => {
//     let id = req.params.id;
//     let job = await workQueue.getJob(id);
//
//     if (job === null) {
//         res.status(404).end();
//     } else {
//         let state = await job.getState();
//         let progress = job._progress;
//         let reason = job.failedReason;
//         res.json({ id, state, progress, reason });
//     }
// });

app.listen(PORT, () =>
  console.log("Server started!", "http://localhost:" + PORT)
);
