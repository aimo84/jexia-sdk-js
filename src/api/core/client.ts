import { IRequestAdapter, RequestAdapter } from "../../internal/requestAdapter";
import { IModule } from "./module";
import { IAuthOptions, TokenManager } from "./tokenManager";

export class Client {
  /* token manager (responsible for getting fresh and valid token), should be injected to plugins/modules (if needed) */
  public tokenManager: TokenManager;
  /* request adapter */
  private requestAdapter: IRequestAdapter;
  /* application URL */
  private projectID: string;
  /* modules to be initilized */
  private modules: IModule[];

  public constructor(private fetch: Function) {
    this.requestAdapter = new RequestAdapter(this.fetch);
    this.tokenManager = new TokenManager(this.requestAdapter);
  }

  public init(opts: IAuthOptions, ...modules: IModule[]): Promise<Client> {
    /* save only projectID (do not store key and secret) */
    this.projectID = opts.projectID;
    this.modules = modules;

    return this.tokenManager.init(opts)
      /* init all modules */
      .then(() => Promise.all(modules.map((curr) => curr.init(this.projectID, this.tokenManager, this.requestAdapter))))
      /* make the Client available only after all modules have been successfully initialized */
      .then(() => this)
      /* if token manager failed to init or at least one of core modules failed to load */
      .catch((err: Error) => {
        /* stop refresh loop */
        this.tokenManager.terminate();
        /* throw error up (to global catch)*/
        throw err;
      });
  }

  public terminate(): Promise<Client> {
    /* terminates the token manager */
    this.tokenManager.terminate();
    /* creates an array of promises to store the resulting promises when calling the terminate method of each module */
    let promises: Array<Promise<any>> = [];

    this.modules.forEach( (module) => {
      /* the promise is stored in an array to catch if some on the promises throws an error */
      promises.push(module.terminate());
    });

    return Promise.all(promises)
      /* Make the client still available (not initialized) after terminated */
      .then(() => this)
      .catch((err: Error) => {
        throw err;
      });
  }
}

export function authenticate(projectID: string, key: string, secret: string): IAuthOptions {
  return {projectID, key, secret};
}
