import axios from "axios";
import adal from "adal-node";
//import { cdg } from "../utils";

let AuthenticationContext = adal.AuthenticationContext;

interface params {
  tenant: any;
  clientId: any;
  clientSecret: any;
  authorityHostUrl: string;
}
let writableParams: params = {
  tenant: process.env.AD_TENANT,
  clientId: process.env.AD_CLIENT,
  clientSecret: process.env.AD_CLIENT,
  authorityHostUrl: "https://login.windows.net",
};

let authorityUrl =
  writableParams.authorityHostUrl +
  "/" +
  writableParams.tenant +
  "/oauth2/v2.0/token";
let resource = "https://graph.microsoft.com";

export class AzureAdHelper {
  static turnOnLogging() {
    let log = adal.Logging;
    log.setLoggingOptions({
      //level : log.LOGGING_LEVEL.VERBOSE,
      log: function (level: any, message: any, error: any) {
        console.log(message);
        if (error) {
          console.log(error);
        }
      },
    });
  }
  static tokenWithUserCredentials(username: string, password: string) {
    return new Promise((resolve) => {
      //turnOnLogging();

      let context = new AuthenticationContext(authorityUrl);

      context.acquireTokenWithUsernamePassword(
        resource,
        username,
        password,
        writableParams.clientId,
        function (err: any, tokenResponse: any) {
          if (err) {
            console.log(err.message, 1);
            resolve({ status: 1, data: err.message });
          } else {
            let accessToken = tokenResponse.accessToken;
            let refreshToken = tokenResponse.refreshToken;
            let expiresOn = tokenResponse.expiresOn;
            let expiresIn = tokenResponse.expiresIn; /**/

            AzureAdHelper.fetchUserData(accessToken).then((openGraph: any) => {
              let userData = [];
              if (openGraph.status === 0) {
                userData = openGraph.data;
              } else {
                console.log(openGraph, 1);
              }

              resolve({
                status: 0,
                data: {
                  user: userData,
                  token: {
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    expiresOn: expiresOn,
                    expiresIn: expiresIn,
                  },
                },
              });
            }); /**/
          }
        },
      );
    }).catch((e) => {
      console.log(e, 1);
      return {
        status: 1,
        // I swapped this for response clarity purposes
        // data: "Une erreur s'est produite, réessayer plutard.",
        data: null,
        error: e,
      };
    });
  }
  static fetchUserData(token: string) {
    return new Promise((resolve, reject) => {
      axios({
        method: "get",
        url: `https://graph.microsoft.com/v1.0/me/`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async function (response: any) {
          resolve({ status: 0, data: response.data });
        })
        .catch(function (error: any) {
          resolve({ status: 1, error: error });
        });
    });
  }
}
