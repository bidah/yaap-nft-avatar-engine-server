import { NextFunction, Request, Response } from "express";
import firebase from "../firebase";

export async function useAuthWithToken(
  req: Request & { authWithToken: object },
  res: Response,
  next: NextFunction
) {
  try {
    const authWallRes = await firebase.getAuthWithToken(req.query.userToken);
    if (res) {
      req.authWithToken = authWallRes;
      return next();
    }
  } catch (e) {
    return res.json({ status: "error", error: e });
  }
}
