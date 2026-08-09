type NavigatorLike = Pick<Navigator, 'maxTouchPoints' | 'platform' | 'userAgent'> & {
  standalone?: boolean;
};

type WindowLike = {
  matchMedia?: (query: string) => {matches: boolean};
};

export function isIPhoneDevice(navigatorLike: NavigatorLike = navigator) {
  return /iPhone|iPod/.test(navigatorLike.userAgent);
}

export function isIOSDevice(navigatorLike: NavigatorLike = navigator) {
  return /iPad|iPhone|iPod/.test(navigatorLike.userAgent) ||
    (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1);
}

export function isStandaloneWebApp(windowLike: WindowLike = window, navigatorLike: NavigatorLike = navigator) {
  return windowLike.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorLike.standalone === true;
}
