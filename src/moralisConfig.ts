import Moralis from "moralis/node";
import { NFTStorage, File } from "nft.storage";
/* Moralis init code */

const CONFIG = {
  hardhat: {
    serverUrl: "",
    appId: "",
  },
  mumbai: {
    serverUrl: process.env?.MORALIS_SERVER_URL_MUMBAI,
    appId: process.env?.MORALIS_APP_ID_MUMBAI
  }
};

Moralis.start({
  serverUrl: CONFIG["mumbai"].serverUrl,
  appId: CONFIG["mumbai"].appId,
})
  .then((msg) => console.log("moralis started!"))
  .catch((error) => console.log("moralis not started:", error));

export const nftStorage = new NFTStorage({ token: process.env?.NFTSTORAGE_API_KEY || "" });

export default Moralis;
