# YAAP engine

YAAP Engine is a NFT avatar generator server that enables your dapp to generate collections previews on the fly with instant feedback, endpoints to deploy all schemas, for serving schemas and deploying ERC721 avatar custom contract.

## ⚙️ Generator `/generate`
Takes all layers and layer configs and generates back avatar schemas with unique DNA

## 🤖 Deploy Images `/generate/deploy-images`
Deploys all collection images to IPFS and then stores resulting hash back into schema.

## 🔗 Deploy API `/generate/deploy-api`
Creates an API endpoint for the collection as a folder on IPFS that contains all the collection's schemas. 

## 🏭 Deploy ERC721 Custom Avatar Contract  `/new-factory-contract`
Deploys a new ERC721 avatar custom contract with url set to your avatar collection API

## 📚 Stack
- Express.js
- TypeScript
- Redis
- Firebase
- BullMQ

## ⚡️ Third party services / libraries
- NFT.Storage 
- Moralis SDK
- Google Storage
- Heroku

## Setup

### `.env` setup

First install all dependecies with 

```bash
yarn install
```

Create your `.env` file from `.env.sample`

```bash
cp .env.sample .env
```

Add all `.env` required variables from the following services

- [FIREBASE_API_KEY](https://www.google.com/search?q=firebase&oq=firebase&aqs=edge..69i57j69i59l2j69i60l4j69i64.3187j0j1&sourceid=chrome&ie=UTF-8)
- [NFTSTORAGE_API_KEY](https://nft.storage/)
- [HEROKU_REDIS_URL](https://devcenter.heroku.com/articles/heroku-redis)
- [MORALIS_APP_ID_MUMBAI](http://moralis.io/)
- [MORALIS_SERVER_URL_MUMBAI](http://moralis.io/)




