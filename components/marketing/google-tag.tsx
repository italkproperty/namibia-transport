import { adsId } from "@/lib/marketing/google-ads";

/**
 * The Google Ads tag, with consent denied by default and no banner.
 *
 * That combination is deliberate, and it works here for a reason that would
 * not hold on most sites: the conversion this business actually cares about
 * never passes through the browser. Money arrives either as a card payment
 * the server verifies against the gateway, or as a bank transfer an operator
 * confirms days later — and both are reported against the click identifier we
 * store ourselves, from the URL, on a booking the traveller chose to submit.
 * That is first-party data, not a cookie read, so it keeps working with every
 * consent signal denied.
 *
 * What we give up is the browser-side count in the EEA and the UK, which
 * Google will model rather than observe. What we keep is a site that sets no
 * advertising cookie and therefore still needs no consent banner — on a
 * business whose entire proposition is being trusted by somebody who has not
 * landed yet, that is the better side of the trade. If the browser count ever
 * has to be exact in Europe, the banner comes first and this default changes
 * with it; it must not be loosened on its own.
 *
 * ## Why plain script tags rather than `next/script`
 *
 * Both of Next's useful strategies are wrong here. `afterInteractive` puts
 * the whole tag behind React hydration, which on a marketing page with sixty
 * chunks over a Namibian mobile connection is seconds — during which anything
 * inspecting the page, Google's own installation check included, sees a site
 * with no tag on it. `beforeInteractive` does the right thing but trips a
 * lint rule written for the Pages Router, and silencing a rule to reach the
 * behaviour two plain tags already give is a poor trade.
 *
 * So this is Google's published snippet, unchanged except for the consent
 * block: an async loader and an inline bootstrap, both in the server-rendered
 * HTML. The preload scanner starts the fetch immediately, the inline script
 * runs as it is parsed, and `dataLayer` is a queue — so consent is recorded
 * before any measurement command whatever order the network resolves in.
 *
 * `url_passthrough` is deliberately not enabled. It is Google's mechanism for
 * carrying a gclid between pages when cookies are denied, which is the job
 * `lib/marketing/attribution.ts` already does — and does through to the
 * database, which Google's cannot. Two mechanisms appending the same
 * parameter to the same links would double query strings for no gain.
 */
export function GoogleTag() {
  const id = adsId();
  if (!id) return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script
        id="gtag-init"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied'
});
gtag('js', new Date());
gtag('config', '${id}');
`,
        }}
      />
    </>
  );
}
