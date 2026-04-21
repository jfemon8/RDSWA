/**
 * Monochrome SVG brand icons for the app-store download buttons in the
 * footer. All inherit `fill="currentColor"` so they adopt the surrounding
 * text colour (useful for theming via the CSS --primary variable).
 *
 * Paths are sourced from Simple Icons (CC0 project-wide); icons are used
 * only as unambiguous hyperlinks to the respective stores, which is
 * standard nominative fair use.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

export function PlayStoreIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zM14.916 12l2.582 2.583 3.535-2.008a1.249 1.249 0 000-2.164l-3.535-2.008L14.916 12zm-1.414-1.414l-10.1-5.736 10.2 10.2-.1-4.464zm.001 2.83l10.2 10.2-10.1-5.736.099-4.464h-.199z" />
    </svg>
  );
}

export function AppleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.543 12.69c-.024-2.47 2.013-3.656 2.106-3.714-1.146-1.676-2.928-1.905-3.567-1.933-1.52-.154-2.968.894-3.74.894-.772 0-1.96-.87-3.22-.847-1.657.024-3.183.963-4.036 2.446-1.72 2.982-.44 7.396 1.237 9.816.815 1.184 1.787 2.515 3.062 2.468 1.232-.05 1.697-.796 3.186-.796 1.49 0 1.907.796 3.207.77 1.323-.024 2.162-1.207 2.974-2.394.938-1.376 1.326-2.714 1.35-2.783-.03-.014-2.588-.994-2.614-3.94zm-2.468-7.232c.685-.83 1.145-1.985 1.02-3.13-.985.04-2.177.655-2.884 1.487-.634.737-1.188 1.912-1.038 3.036 1.098.085 2.219-.56 2.902-1.393z" />
    </svg>
  );
}

export function WindowsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801" />
    </svg>
  );
}

/**
 * Simplified Tux silhouette for Linux. Recognizable at the 18–24px sizes
 * used by the footer buttons. Keeping the geometry simple avoids fidelity
 * loss that a full-detail Tux path would suffer at small sizes.
 */
export function LinuxIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C10.3 2 9 3.3 9 5c0 .3.1.6.2.9-2 .9-3.2 3-3.2 5.6 0 .9.2 1.8.5 2.5l-1.2 1.6c-.3.4-.2 1 .2 1.4.4.3 1 .2 1.4-.2l.8-1.1c.6.6 1.3 1.1 2.1 1.4.1 0 .2.1.3.1V19H9c-.6 0-1 .5-1 1s.4 1 1 1h6c.6 0 1-.4 1-1s-.4-1-1-1h-1.1v-1.8c.1 0 .2-.1.3-.1.8-.3 1.5-.8 2.1-1.4l.8 1.1c.3.4 1 .5 1.4.2.4-.4.5-1 .2-1.4l-1.2-1.6c.3-.8.5-1.6.5-2.5 0-2.6-1.3-4.7-3.2-5.6.1-.3.2-.6.2-.9 0-1.7-1.3-3-3-3zm0 1.6c.8 0 1.4.6 1.4 1.4S12.8 6.4 12 6.4s-1.4-.6-1.4-1.4S11.2 3.6 12 3.6zM9.5 9.6c.6 0 1 .5 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm5 0c.6 0 1 .5 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zM12 12.4c.9 0 1.7.3 2.3.9.1.1.2.2.2.3 0 .2-.1.4-.3.4-.5 0-1.1.3-1.5.7-.2.2-.4.3-.7.3s-.5-.1-.7-.3c-.4-.4-1-.7-1.5-.7-.2 0-.3-.2-.3-.4 0-.1.1-.2.2-.3.6-.6 1.4-.9 2.3-.9z" />
    </svg>
  );
}
