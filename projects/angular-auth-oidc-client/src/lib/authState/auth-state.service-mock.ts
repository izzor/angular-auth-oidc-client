import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthenticatedResult } from './auth-result';

@Injectable()
export class AuthStateServiceMock {
  // event which contains the state
  private authorizedInternal$ = new BehaviorSubject<boolean>(false);

  get authorized$() {
    return this.authorizedInternal$.asObservable();
  }

  setAuthenticatedAndFireEvent(): void {}

  setUnauthenticatedAndFireEvent(): void {}

  initStateFromStorage(): void {}

  updateAndPublishAuthState(authorizationResult: AuthenticatedResult) {}

  setAuthorizationData(accessToken: any, idToken: any) {}

  getAccessToken(): string {
    return null;
  }

  getIdToken(): string {
    return null;
  }

  getRefreshToken(): string {
    return null;
  }

  areAuthStorageTokensValid() {
    return true;
  }

  setAuthResultInStorage(authResult: any) {}

  hasIdTokenExpired() {
    return true;
  }

  hasAccessTokenExpiredIfExpiryExists() {
    return true;
  }
}
