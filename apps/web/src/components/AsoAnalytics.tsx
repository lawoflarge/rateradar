/**
 * Funnel measurement: page view to App Store click.
 *
 * Vercel Web Analytics is cookieless; the event carries only the placement of
 * the button that was clicked and the path it was clicked on. No identifiers,
 * no third-party tracker.
 */

const CLICK_TRACKER = `(function(){
  window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
  document.addEventListener('click',function(e){
    var t=e.target;
    if(!t||typeof t.closest!=='function')return;
    var a=t.closest('a[href*="apps.apple.com"]');
    if(!a)return;
    va('event',{name:'appstore_click',data:{
      placement:a.getAttribute('data-aso-cta')||'unmarked',
      page:location.pathname
    }});
  },{capture:true,passive:true});
})();`;

export function AsoAnalytics() {
  return (
    <>
      <script defer src="/_vercel/insights/script.js" />
      <script dangerouslySetInnerHTML={{ __html: CLICK_TRACKER }} />
    </>
  );
}
