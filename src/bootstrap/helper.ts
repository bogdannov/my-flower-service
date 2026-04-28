import { inject } from "../bootstrap/inject";

export async function config() {
  try {
    return await inject().Config();
  } catch (error) {
    console.log("Failed to inject Config instance.", error);
    throw new Error("Internal Server Error");
  }
}

export async function logger() {
  try {
    return await inject().Logger();
  } catch (error) {
    console.log("Failed to inject Logger instance.", error);
    throw new Error("Internal Server Error");
  }
}
