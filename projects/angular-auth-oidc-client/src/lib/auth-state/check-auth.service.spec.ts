import { TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { mockClass } from '../../test/auto-mock';
import { AutoLoginService } from '../auto-login/auto-login.service';
import { CallbackService } from '../callback/callback.service';
import { PeriodicallyTokenCheckService } from '../callback/periodically-token-check.service';
import { RefreshSessionService } from '../callback/refresh-session.service';
import { StsConfigLoader, StsConfigStaticLoader } from '../config/loader/config-loader';
import { CheckSessionService } from '../iframe/check-session.service';
import { SilentRenewService } from '../iframe/silent-renew.service';
import { LoggerService } from '../logging/logger.service';
import { PopUpService } from '../login/popup/popup.service';
import { PublicEventsService } from '../public-events/public-events.service';
import { StoragePersistenceService } from '../storage/storage-persistence.service';
import { UserService } from '../user-data/user.service';
import { CurrentUrlService } from '../utils/url/current-url.service';
import { AuthStateService } from './auth-state.service';
import { CheckAuthService } from './check-auth.service';

describe('CheckAuthService', () => {
  let checkAuthService: CheckAuthService;
  let authStateService: AuthStateService;
  let userService: UserService;
  let checkSessionService: CheckSessionService;
  let callBackService: CallbackService;
  let silentRenewService: SilentRenewService;
  let periodicallyTokenCheckService: PeriodicallyTokenCheckService;
  let refreshSessionService: RefreshSessionService;
  let popUpService: PopUpService;
  let autoLoginService: AutoLoginService;
  let storagePersistenceService: StoragePersistenceService;
  let currentUrlService: CurrentUrlService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: CheckSessionService, useClass: mockClass(CheckSessionService) },
        { provide: SilentRenewService, useClass: mockClass(SilentRenewService) },
        { provide: UserService, useClass: mockClass(UserService) },
        { provide: LoggerService, useClass: mockClass(LoggerService) },
        { provide: AuthStateService, useClass: mockClass(AuthStateService) },
        { provide: CallbackService, useClass: mockClass(CallbackService) },
        { provide: RefreshSessionService, useClass: mockClass(RefreshSessionService) },
        { provide: PeriodicallyTokenCheckService, useClass: mockClass(PeriodicallyTokenCheckService) },
        { provide: PopUpService, useClass: mockClass(PopUpService) },
        { provide: StsConfigLoader, useClass: mockClass(StsConfigStaticLoader) },
        {
          provide: StoragePersistenceService,
          useClass: mockClass(StoragePersistenceService),
        },
        AutoLoginService,
        CheckAuthService,
        {
          provide: CurrentUrlService,
          useClass: mockClass(CurrentUrlService),
        },
        {
          provide: PublicEventsService,
          useClass: mockClass(PublicEventsService),
        },
      ],
    });
  });

  beforeEach(() => {
    checkAuthService = TestBed.inject(CheckAuthService);
    refreshSessionService = TestBed.inject(RefreshSessionService);
    userService = TestBed.inject(UserService);
    authStateService = TestBed.inject(AuthStateService);
    checkSessionService = TestBed.inject(CheckSessionService);
    callBackService = TestBed.inject(CallbackService);
    silentRenewService = TestBed.inject(SilentRenewService);
    periodicallyTokenCheckService = TestBed.inject(PeriodicallyTokenCheckService);
    popUpService = TestBed.inject(PopUpService);
    autoLoginService = TestBed.inject(AutoLoginService);
    storagePersistenceService = TestBed.inject(StoragePersistenceService);
    currentUrlService = TestBed.inject(CurrentUrlService);
  });

  afterEach(() => {
    storagePersistenceService.clear(null);
  });

  it('should create', () => {
    expect(checkAuthService).toBeTruthy();
  });

  describe('checkAuth', () => {
    it('uses config with matching state when url has state param and config with state param is stored', () => {
      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(true);
      spyOn(currentUrlService, 'getStateParamFromCurrentUrl').and.returnValue('the-state-param');
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(storagePersistenceService, 'read').withArgs('authStateControl', allConfigs[0]).and.returnValue('the-state-param');
      const spy = spyOn(checkAuthService as any, 'checkAuthWithConfig').and.callThrough();

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalledOnceWith(allConfigs[0], allConfigs, undefined);
      });
    });

    it('throws error when url has state param and stored config with matching state param is not found', () => {
      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(true);
      spyOn(currentUrlService, 'getStateParamFromCurrentUrl').and.returnValue('the-state-param');
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(storagePersistenceService, 'read').withArgs('authStateControl', allConfigs[0]).and.returnValue('not-matching-state-param');
      const spy = spyOn(checkAuthService as any, 'checkAuthWithConfig').and.callThrough();

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe({
        error: (err) => {
          expect(err).toBeTruthy();
          expect(spy).not.toHaveBeenCalled();
        },
      });
    });

    it('uses first/default config when no param is passed', () => {
      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(false);
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];
      const spy = spyOn(checkAuthService as any, 'checkAuthWithConfig').and.callThrough();

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalledOnceWith({ configId: 'configId1', authority: 'some-authority' }, allConfigs, undefined);
      });
    });

    it('returns isAuthenticated: false with error message when config is not valid', waitForAsync(() => {
      const allConfigs = [];

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) =>
        expect(result).toEqual({
          isAuthenticated: false,
          errorMessage: 'Please provide at least one configuration before setting up the module',
          configId: null,
          idToken: null,
          userData: null,
          accessToken: null,
        })
      );
    }));

    it('returns null and sendMessageToMainWindow if currently in a popup', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(popUpService, 'isCurrentlyInPopup').and.returnValue(true);
      const popupSpy = spyOn(popUpService, 'sendMessageToMainWindow');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toBeNull();
        expect(popupSpy).toHaveBeenCalled();
      });
    }));

    it('returns isAuthenticated: false with error message in case handleCallbackAndFireEvents throws an error', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(true);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      const spy = spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(throwError(() => new Error('ERROR')));

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toEqual({
          isAuthenticated: false,
          errorMessage: 'ERROR',
          configId: 'configId1',
          idToken: null,
          userData: null,
          accessToken: null,
        });
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('calls callbackService.handlePossibleStsCallback with current url when callback is true', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(true);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      const spy = spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toEqual({
          isAuthenticated: true,
          userData: undefined,
          accessToken: undefined,
          configId: 'configId1',
          idToken: undefined,
        });
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('does NOT call handleCallbackAndFireEvents with current url when callback is false', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(false);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      const spy = spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toEqual({
          isAuthenticated: true,
          userData: undefined,
          accessToken: undefined,
          configId: 'configId1',
          idToken: undefined,
        });
        expect(spy).not.toHaveBeenCalled();
      });
    }));

    it('does fire the auth and user data events when it is not a callback from the security token service and is authenticated', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(false);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));

      const setAuthorizedAndFireEventSpy = spyOn(authStateService, 'setAuthenticatedAndFireEvent');
      const userServiceSpy = spyOn(userService, 'publishUserDataIfExists');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toEqual({
          isAuthenticated: true,
          userData: undefined,
          accessToken: undefined,
          configId: 'configId1',
          idToken: undefined,
        });
        expect(setAuthorizedAndFireEventSpy).toHaveBeenCalled();
        expect(userServiceSpy).toHaveBeenCalled();
      });
    }));

    it('does NOT fire the auth and user data events when it is not a callback from the security token service and is NOT authenticated', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(false);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(false);
      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));

      const setAuthorizedAndFireEventSpy = spyOn(authStateService, 'setAuthenticatedAndFireEvent');
      const userServiceSpy = spyOn(userService, 'publishUserDataIfExists');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toEqual({
          isAuthenticated: false,
          userData: undefined,
          accessToken: undefined,
          configId: 'configId1',
          idToken: undefined,
        });
        expect(setAuthorizedAndFireEventSpy).not.toHaveBeenCalled();
        expect(userServiceSpy).not.toHaveBeenCalled();
      });
    }));

    it('if authenticated return true', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toEqual({
          isAuthenticated: true,
          userData: undefined,
          accessToken: undefined,
          configId: 'configId1',
          idToken: undefined,
        });
      });
    }));

    it('if authenticated set auth and fires event ', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);

      const spy = spyOn(authStateService, 'setAuthenticatedAndFireEvent');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('if authenticated publishUserdataIfExists', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);

      const spy = spyOn(userService, 'publishUserDataIfExists');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('if authenticated callbackService startTokenValidationPeriodically', waitForAsync(() => {
      const config = {
        authority: 'authority',
        tokenRefreshInSeconds: 7,
      };
      const allConfigs = [config];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);

      const spy = spyOn(periodicallyTokenCheckService, 'startTokenValidationPeriodically');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('if isCheckSessionConfigured call checkSessionService.start()', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      spyOn(checkSessionService, 'isCheckSessionConfigured').and.returnValue(true);
      const spy = spyOn(checkSessionService, 'start');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('if isSilentRenewConfigured call getOrCreateIframe()', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      spyOn(silentRenewService, 'isSilentRenewConfigured').and.returnValue(true);
      const spy = spyOn(silentRenewService, 'getOrCreateIframe');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('calls checkSavedRedirectRouteAndNavigate if authenticated', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);
      const spy = spyOn(autoLoginService, 'checkSavedRedirectRouteAndNavigate');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledOnceWith(allConfigs[0]);
      });
    }));

    it('does not call checkSavedRedirectRouteAndNavigate if not authenticated', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(false);
      const spy = spyOn(autoLoginService, 'checkSavedRedirectRouteAndNavigate');

      checkAuthService.checkAuth(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalledTimes(0);
      });
    }));
  });

  describe('checkAuthIncludingServer', () => {
    it('if isSilentRenewConfigured call getOrCreateIframe()', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(true);

      spyOn(silentRenewService, 'isSilentRenewConfigured').and.returnValue(true);
      const spy = spyOn(silentRenewService, 'getOrCreateIframe');

      checkAuthService.checkAuthIncludingServer(allConfigs[0], allConfigs).subscribe(() => {
        expect(spy).toHaveBeenCalled();
      });
    }));

    it('does forceRefreshSession get called and is NOT authenticated', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(false);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(false);
      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));

      spyOn(refreshSessionService, 'forceRefreshSession').and.returnValue(
        of({
          idToken: 'idToken',
          accessToken: 'access_token',
          isAuthenticated: false,
          userData: null,
          configId: 'configId1',
        })
      );

      checkAuthService.checkAuthIncludingServer(allConfigs[0], allConfigs).subscribe((result) => {
        expect(result).toBeTruthy();
      });
    }));

    it('should start check session and validation after forceRefreshSession has been called and is authenticated after forcing with silentrenew', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(false);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(false);
      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(checkSessionService, 'isCheckSessionConfigured').and.returnValue(true);
      spyOn(silentRenewService, 'isSilentRenewConfigured').and.returnValue(true);

      const checkSessionServiceStartSpy = spyOn(checkSessionService, 'start');
      const periodicallyTokenCheckServiceSpy = spyOn(periodicallyTokenCheckService, 'startTokenValidationPeriodically');
      const getOrCreateIframeSpy = spyOn(silentRenewService, 'getOrCreateIframe');

      spyOn(refreshSessionService, 'forceRefreshSession').and.returnValue(
        of({
          idToken: 'idToken',
          accessToken: 'access_token',
          isAuthenticated: true,
          userData: null,
          configId: 'configId1',
        })
      );

      checkAuthService.checkAuthIncludingServer(allConfigs[0], allConfigs).subscribe(() => {
        expect(checkSessionServiceStartSpy).toHaveBeenCalledOnceWith(allConfigs[0]);
        expect(periodicallyTokenCheckServiceSpy).toHaveBeenCalledTimes(1);
        expect(getOrCreateIframeSpy).toHaveBeenCalledOnceWith(allConfigs[0]);
      });
    }));

    it('should start check session and validation after forceRefreshSession has been called and is authenticated after forcing without silentrenew', waitForAsync(() => {
      const allConfigs = [{ configId: 'configId1', authority: 'some-authority' }];

      spyOn(callBackService, 'isCallback').and.returnValue(false);
      spyOn(authStateService, 'areAuthStorageTokensValid').and.returnValue(false);
      spyOn(callBackService, 'handleCallbackAndFireEvents').and.returnValue(of(null));
      spyOn(checkSessionService, 'isCheckSessionConfigured').and.returnValue(true);
      spyOn(silentRenewService, 'isSilentRenewConfigured').and.returnValue(false);

      const checkSessionServiceStartSpy = spyOn(checkSessionService, 'start');
      const periodicallyTokenCheckServiceSpy = spyOn(periodicallyTokenCheckService, 'startTokenValidationPeriodically');
      const getOrCreateIframeSpy = spyOn(silentRenewService, 'getOrCreateIframe');

      spyOn(refreshSessionService, 'forceRefreshSession').and.returnValue(
        of({
          idToken: 'idToken',
          accessToken: 'access_token',
          isAuthenticated: true,
          userData: null,
          configId: 'configId1',
        })
      );

      checkAuthService.checkAuthIncludingServer(allConfigs[0], allConfigs).subscribe(() => {
        expect(checkSessionServiceStartSpy).toHaveBeenCalledOnceWith(allConfigs[0]);
        expect(periodicallyTokenCheckServiceSpy).toHaveBeenCalledTimes(1);
        expect(getOrCreateIframeSpy).not.toHaveBeenCalled();
      });
    }));
  });

  describe('checkAuthMultiple', () => {
    it('uses config with matching state when url has state param and config with state param is stored', waitForAsync(() => {
      const allConfigs = [
        { configId: 'configId1', authority: 'some-authority1' },
        { configId: 'configId2', authority: 'some-authority2' },
      ];

      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(true);
      spyOn(currentUrlService, 'getStateParamFromCurrentUrl').and.returnValue('the-state-param');
      spyOn(storagePersistenceService, 'read').withArgs('authStateControl', allConfigs[0]).and.returnValue('the-state-param');
      const spy = spyOn(checkAuthService as any, 'checkAuthWithConfig').and.callThrough();

      checkAuthService.checkAuthMultiple(allConfigs).subscribe((result) => {
        expect(Array.isArray(result)).toBe(true);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.calls.argsFor(0)).toEqual([allConfigs[0], allConfigs, undefined]);
        expect(spy.calls.argsFor(1)).toEqual([allConfigs[1], allConfigs, undefined]);
      });
    }));

    it('uses config from passed configId if configId was passed and returns all results', waitForAsync(() => {
      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(false);

      const allConfigs = [
        { configId: 'configId1', authority: 'some-authority1' },
        { configId: 'configId2', authority: 'some-authority2' },
      ];

      const spy = spyOn(checkAuthService as any, 'checkAuthWithConfig').and.callThrough();

      checkAuthService.checkAuthMultiple(allConfigs).subscribe((result) => {
        expect(Array.isArray(result)).toBe(true);
        expect(spy.calls.allArgs()).toEqual([
          [{ configId: 'configId1', authority: 'some-authority1' }, allConfigs, undefined],
          [{ configId: 'configId2', authority: 'some-authority2' }, allConfigs, undefined],
        ]);
      });
    }));

    it('runs through all configs if no parameter is passed and has no state in url', waitForAsync(() => {
      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(false);

      const allConfigs = [
        { configId: 'configId1', authority: 'some-authority1' },
        { configId: 'configId2', authority: 'some-authority2' },
      ];

      const spy = spyOn(checkAuthService as any, 'checkAuthWithConfig').and.callThrough();

      checkAuthService.checkAuthMultiple(allConfigs).subscribe((result) => {
        expect(Array.isArray(result)).toBe(true);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.calls.argsFor(0)).toEqual([{ configId: 'configId1', authority: 'some-authority1' }, allConfigs, undefined]);
        expect(spy.calls.argsFor(1)).toEqual([{ configId: 'configId2', authority: 'some-authority2' }, allConfigs, undefined]);
      });
    }));

    it('throws error if url has state param but no config could be found', waitForAsync(() => {
      spyOn(currentUrlService, 'currentUrlHasStateParam').and.returnValue(true);
      spyOn(currentUrlService, 'getStateParamFromCurrentUrl').and.returnValue('the-state-param');

      const allConfigs = [];

      checkAuthService.checkAuthMultiple(allConfigs).subscribe({
        error: (error) => {
          expect(error.message).toEqual('could not find matching config for state the-state-param');
        },
      });
    }));
  });
});
