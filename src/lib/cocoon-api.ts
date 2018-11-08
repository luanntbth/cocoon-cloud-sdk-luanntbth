"use strict";

import * as detectNode from "detect-node";
import {default as popsicle, Middleware, plugins as posiclePlugins, RequestOptions, Response} from "popsicle";

import APIURL from "./api-url";
import CookieCredentialStorage from "./cookie-credential-storage";
import {ICocoonTemplate} from "./interfaces/i-cocoon-template";
import {ICocoonVersion} from "./interfaces/i-cocoon-version";
import {ICredentialStorage} from "./interfaces/i-credential-storage";
import MemoryCredentialStorage from "./memory-credential-storage";
import status = require("popsicle-status");

export default class CocoonAPI {
	public static get credentials(): ICredentialStorage {
		return this._credentials;
	}

	/**
	 * Checks if the API access works.
	 * @returns {boolean} If the API access works.
	 */
	public static checkAPIAccess(): boolean {
		if (CocoonAPI.credentials) {
			return !!CocoonAPI.credentials.getAccessToken();
		} else {
			return false;
		}
	}

	/**
	 * Prepares the API to be used. After successfully setting up the API access, you can use the whole SDK.
	 * @param accessToken Access token provided by the Cocoon.io server.
	 * @param refreshToken Refresh token provided by the Cocoon.io server.
	 * @param expiration Time, in seconds, the access token is valid.
	 * @param apiURL URL where the Cocoon.io API is located.
	 */
	public static setupAPIAccess(accessToken: string, refreshToken: string, expiration?: number, apiURL?: string): void {
		if (apiURL) {
			APIURL.BASE = apiURL;
		}
		CocoonAPI._credentials = detectNode ? new MemoryCredentialStorage() : new CookieCredentialStorage();
		CocoonAPI._credentials.setAccessToken(accessToken, expiration);
		CocoonAPI._credentials.setRefreshToken(refreshToken);
	}

	/**
	 * Refreshes the API credentials.
	 */
	public static async refreshAPIAccess(): Promise<void> {
		console.log("Refreshing access credentials...");
		return popsicle({
			method: "GET",
			url: APIURL.API_REFRESH(this.credentials.getRefreshToken()),
		})
			.use(posiclePlugins.parse("json"))
			.then((result) => {
				this.setupAPIAccess(result.body.access_token, result.body.refresh_token, result.body.expires_in);
				console.log("Access credentials refreshed.");
			});
	}

	/**
	 * Removes the stored credentials.
	 */
	public static closeAPIAccess(): void {
		CocoonAPI.credentials.logout();
	}

	/**
	 * Get a list of the available templates for Cocoon.io projects from the API.
	 * @returns {Promise<ICocoonTemplate[]>} Promise of the list of the available templates for Cocoon.io projects.
	 */
	public static async getCocoonTemplates(): Promise<ICocoonTemplate[]> {
		return (await CocoonAPI.request({
			method: "GET",
			url: APIURL.COCOON_TEMPLATES,
		}, [posiclePlugins.parse("json")])).body;
	}

	/**
	 * Get a list of the available Cocoon.io versions.
	 * @returns {Promise<ICocoonVersion[]>} Promise of the list of the available Cocoon.io versions.
	 */
	public static async getCocoonVersions(): Promise<ICocoonVersion[]> {
		return (await CocoonAPI.request({
			method: "GET",
			url: APIURL.COCOON_VERSIONS,
		}, [posiclePlugins.parse("json")])).body;
	}

	/**
	 * Make a request to the API with your credentials.
	 * @param options HTTP options of the request.
	 * @param plugins List of plugins to use.
	 * @param addCredentials Set to false in case you don't want to automatically add your credentials to the API.
	 * @returns {Request}
	 */
	public static async request(options: RequestOptions, plugins: Middleware[] = [], addCredentials: boolean = true): Promise<Response> {
		if (addCredentials) {
			if (!options.headers) {
				options.headers = {};
			}
			if (this.credentials) {
				if (CocoonAPI.credentials.expireDate > new Date()) {
					console.log("Access credentials expired.");
					await this.refreshAPIAccess();
				}

				options.headers.Authorization = "Bearer " + this.credentials.getAccessToken();
			} else {
				throw new Error("API access has not been set up");
			}
		}
		plugins.push(status());
		return popsicle(options).use(plugins);
	}

	private static _credentials: ICredentialStorage;
}
