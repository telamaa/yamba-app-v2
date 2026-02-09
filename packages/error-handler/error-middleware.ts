import {AppError} from "./index";
import {Request, Response, NextFunction} from "express";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if(err instanceof AppError){
    console.log(`Error ${req.method} ${req.url} - ${err.message}`);

    // ne pas exposer details en production
    const isProd = process.env.NODE_ENV === "production";

    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...( !isProd && err.details ? { details: err.details } : {}),
    });
  }

  console.log("Unhandled error: ", err);

  return res.status(500).json({
    error: "Something went wrong, please try again!",
  });

};
