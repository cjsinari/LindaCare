/*
 * Design tokens for the LindaCare mobile app.
 *
 * Named here so no screen below this file carries a raw hex value. The web
 * console has the same arrangement in frontend/src/styles/tokens.css, and the
 * two now share a *method* even though they do not share a palette: the
 * console is brand blue on bone, this is navy and teal on a near-white cool
 * grey, and both draw a surface the same way -- a hairline that defines the
 * edge, a shadow small enough you would not notice it was there, and accent
 * colour reserved for the things you can act on.
 *
 * That last sentence is the whole of the restyle. What made these screens look
 * assembled rather than designed was not the brand colours; it was four habits
 * around them:
 *
 *   1. A saturated page.  #eaf1f6 is a visibly blue grey, and every white card
 *      on it read as a cut-out. `page` is now #e6ecf3: cool enough that a
 *      white card separates from it by tone rather than by shadow, flat
 *      enough that it never competes with one.
 *
 *      The first pass of the restyle took it to #f4f6f8 and overshot. Two
 *      steps off white is not a page, it is more white: a screen of white
 *      cards on it read as one undifferentiated sheet, which is the same
 *      problem as the cut-outs wearing different clothes. #e6ecf3 is the
 *      darkest the page can go while `inkMuted` still clears 4.5:1 on it,
 *      which is what set the value.
 *
 *   2. Shadow doing the work of a line.  Every card, tile, search bar and
 *      segmented control floated on a soft 12dp drop shadow and had no edge at
 *      all. Fifteen floating objects on one screen is not depth, it is noise.
 *      Surfaces are now defined by `border` -- a 10%-ink hairline, exactly the
 *      console's `--border` -- with `shadow.card` reduced to a 3dp hint. The
 *      three or four things that genuinely float (a bottom sheet, the pinned
 *      footer, the drawer over its scrim) keep a real shadow, and they are now
 *      the only things that do.
 *
 *   3. Mint standing in for teal.  `tealSoft` was #e4f4ec, byte-for-byte the
 *      same value as `successBg`, so every soft brand tint on these screens was
 *      actually the success green -- including PillButton's `tonal` variant,
 *      which drew teal-branded secondary actions in green on mint. `tealSoft`
 *      is now an actual desaturated teal and `tealInk` is the ink that goes on
 *      it, which also means "secondary action" and "this went well" have
 *      stopped being the same colour.
 *
 *   4. Corners competing with each other.  26dp cards around 18dp inners
 *      around 14dp controls, beside fully round pills, on a 16dp auth card.
 *      The scale is tightened and still concentric (see `oneui.radius`).
 *
 * The brand is untouched: navy #15314f, teal #17807d, the same status family.
 *
 * -- Contrast --
 *
 * Measured, not estimated. Every text and boundary pairing the screens use,
 * against WCAG 2.1 AA (4.5:1 body text, 3:1 large text and UI boundaries):
 *
 *   ink on surface              #14283d on #ffffff   14.99:1  AAA
 *   label on surface            #46678a on #ffffff    5.89:1  AA
 *   label on page               #46678a on #e6ecf3    4.95:1  AA
 *   inkMuted on surface         #4e6a87 on #ffffff    5.62:1  AA
 *   inkMuted on page            #4e6a87 on #e6ecf3    4.73:1  AA
 *   inkMuted on surfaceSunken   #4e6a87 on #eef1f5    4.96:1  AA
 *   white on navy               #ffffff on #15314f   13.26:1  AAA
 *   navy subtitle on navy       #9bb3cc on #15314f    6.13:1  AA
 *   white on teal (button)      #ffffff on #17807d    4.75:1  AA
 *   tealInk on tealSoft         #0f5e5c on #e6f0ef    6.51:1  AA
 *   link on surface             #1c5c96 on #ffffff    6.95:1  AA
 *   success on mint banner      #15674e on #e4f4ec    5.99:1  AA
 *   warning on amber banner     #8a5a10 on #fdf2e2    5.34:1  AA
 *   danger on surface           #c0392b on #ffffff    5.44:1  AA
 *   info on blue banner         #2a5f93 on #e8f1fa    5.83:1  AA
 *   field border on surface     #7e94aa on #ffffff    3.13:1  AA (1.4.11)
 *   teal focus ring on field    #17807d on #f7f9fb    4.50:1  AA (1.4.11)
 *
 * -- The resting field border now passes, and that is a fix, not a tidy-up --
 *
 * It used to be #e2eaf1 on #ffffff: 1.22:1, well under the 3:1 that WCAG
 * 1.4.11 asks of a component boundary, and logged in issue #47 as a knowing
 * deviation with two ways out -- darken it, or accept it in writing. The
 * restyle takes the first: `fieldBorder` is #7e94aa at 3.13:1, drawn at 1dp
 * instead of 1.5dp. A thin line in a colour you can see reads as sharper than
 * a thick one you cannot, so the accessible answer is also the sleeker one
 * here. Issue #47's remaining business is the touch-target sweep.
 *
 * `border` is a different token for a different job and is *not* held to 3:1.
 * At 10% ink it is roughly 1.2:1, and it is a grouping line -- the edge of a
 * card, the rule between two rows -- never the boundary of something you
 * operate. Anything you operate uses `fieldBorder`. This is the same split the
 * console makes between `--border` and `--border-strong`.
 *
 * -- The two that still do not reach a threshold, and why each is allowed to --
 *
 * Placeholder text, #93a7bb on #f7f9fb, is 2.34:1. It is exempt only because
 * it never carries information: every field in this app has a permanently
 * visible label above it, and the placeholder repeats a format hint at most.
 * A placeholder standing in for a label would not be exempt, which is the
 * reason none of them do.
 *
 * Disabled button ink, #8fa0b1 on #eceff3, is 2.33:1 and is exempt under
 * 1.4.3, which excludes inactive controls. The submit button spends real time
 * disabled on these forms, so it never communicates by colour alone: the
 * reason it cannot be pressed is always also stated in text beneath it.
 */

export const colors = {
  // -- Brand --
  navy: '#15314f',          // hero header, splash
  navyDeep: '#102640',      // the lower half of the header gradient
  navyRaised: '#1d4169',    // cards sitting on navy (the frozen screen)
  teal: '#17807d',          // primary action, logo tile
  tealPressed: '#126663',
  // A desaturated teal tint, and the ink that goes on it. This used to be the
  // success green by accident; see note 3 at the top of the file.
  tealSoft: '#e6f0ef',
  tealSoftPressed: '#d8e8e7',
  tealInk: '#0f5e5c',

  // -- Surfaces --
  page: '#e6ecf3',          // behind the white cards: cool, and tinted enough
                            // that a card reads as a card without a shadow
  surface: '#ffffff',
  surfaceSunken: '#eef1f5', // an inset fill: a pressed row, a neutral chip
  field: '#f7f9fb',         // an input's own fill

  // -- Lines --
  // A grouping hairline. Alpha rather than a solid, so one token holds up over
  // both `surface` and `page`.
  border: 'rgba(20, 40, 61, 0.10)',
  // The boundary of something you operate: an input, an outlined control.
  fieldBorder: '#7e94aa',
  fieldBorderFocus: '#17807d',

  // -- Ink --
  ink: '#14283d',
  // Darkened from #55708c when `page` came down to #e6ecf3: at the old value
  // it measured 4.45:1 there, under the 4.5 floor for body text. On every
  // other ground it simply got clearer.
  inkMuted: '#4e6a87',
  label: '#46678a',         // the uppercase field labels
  placeholder: '#93a7bb',
  onNavy: '#ffffff',
  // Desaturated from #7cb0e8. A bright sky blue on navy was the loudest thing
  // on the sign-in screen, and it is subtitle text, which should be the
  // quietest. 6.13:1 -- so it got quieter without getting harder to read.
  onNavyMuted: '#9bb3cc',
  onTeal: '#ffffff',
  link: '#1c5c96',

  // -- Status --
  // Unchanged. These pairs were measured, and they are already what the
  // console does with status: a tinted ground, its own ink, never colour alone.
  success: '#15674e',
  successBg: '#e4f4ec',
  warning: '#8a5a10',
  warningBg: '#fdf2e2',
  danger: '#c0392b',
  dangerBg: '#fdecea',
  dangerBgPressed: '#f9d9d5',
  info: '#2a5f93',
  infoBg: '#e8f1fa',

  // -- Disabled --
  disabledBg: '#eceff3',
  disabledInk: '#8fa0b1',
};

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 44,
};

/*
 * Corner radii for the auth screens.
 *
 * Pulled in from 8/10/16/24. The console sits on 4/8/12 and reads as precise
 * rather than soft; these stay a step rounder than that, because they are
 * being touched rather than clicked, and a step tighter than they were.
 */
export const radius = {
  sm: 6, md: 10, lg: 14, sheet: 20, pill: 999,
};

/*
 * Type.
 *
 * Poppins for headings, because that is what the mockups are set in and its
 * geometric shapes are what make the hero read as a brand rather than as a
 * system dialog. Body text stays on Poppins too for consistency at these
 * sizes. `fonts.load` in src/theme/fonts.js is what actually registers them;
 * every style here names a family that file guarantees exists.
 */
export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const type = {
  hero: { fontFamily: font.bold, fontSize: 28, lineHeight: 36 },
  title: { fontFamily: font.semibold, fontSize: 20, lineHeight: 28 },
  subtitle: { fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  // Uppercase, tracked out, small: the mockups' field labels. Tracking is what
  // keeps uppercase legible at this size.
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 0.8 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  captionMedium: { fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
};

/*
 * The minimum touch target, in density-independent pixels.
 *
 * 48 is the Android accessibility floor and the number the QA pass in issue #47
 * will measure against. Anything tappable in this app either is at least this
 * tall or carries a hitSlop that makes it so.
 */
export const TOUCH_TARGET = 48;

/*
 * Shadow.
 *
 * Two of them, and the distinction is the point. `card` is a hint: it exists
 * so a white card on a near-white page has somewhere to sit, and it is paired
 * with a hairline that does the actual defining. `raised` is for the few
 * things in the app that are genuinely above the page and need to say so -- a
 * bottom sheet, the pinned action footer, the drawer over its scrim.
 *
 * Before the restyle every surface used the heavy one, which is exactly why
 * nothing looked raised: when everything floats, floating stops meaning
 * anything.
 */
export const shadow = {
  card: {
    shadowColor: '#0b2033',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#0b2033',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    elevation: 10,
  },
};

/*
 * Surface treatments: the line and the shadow together, because they are a
 * single decision, and splitting them across two spreads at twenty call sites
 * is how half of them end up with one and not the other.
 *
 * Deliberately no `backgroundColor` -- a caller states its own fill, which is
 * sometimes `surface` and sometimes navy.
 */
export const surface = {
  /** A card, tile, search bar or segmented control: hairline, faint lift. */
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  /** Something genuinely above the page: a sheet, the pinned footer. */
  sheet: { ...shadow.raised },
};

/*
 * --------------------------- One UI 9 ---------------------------
 *
 * The caregiver screens (#44) are drawn in Samsung's One UI 9 idiom, which is
 * the design language of the phones this app is actually installed on in
 * Nairobi. Everything below is additive: the auth screens above predate it and
 * are untouched, so nothing in #41-#43 shifts underfoot.
 *
 * What One UI actually asks for, and what each of these tokens is doing about
 * it:
 *
 *   Reach.  One UI's defining move is pushing content down the screen so the
 *           things you touch sit under your thumb and the things you only read
 *           sit above it. That is `oneui.headroom` -- the empty band a large
 *           title opens with -- and it is why the primary action on these
 *           screens is pinned to the bottom rather than following the content.
 *
 *   The collapsing title.  A large title that shrinks into the bar as the list
 *           scrolls. `oneui.collapse` is the scroll distance over which it
 *           happens and `oneui.barHeight` is what it lands in.
 *
 *   Roundness.  One UI rounds harder than anything else on Android, and the
 *           first draft of these screens took that literally: 26dp cards. At
 *           26dp, on a phone, with a hairline edge and six cards down a
 *           scroll, the corners become the loudest thing on the screen. 20dp
 *           keeps the idiom and loses the bubble. What has not changed is that
 *           nested corners are concentric rather than identical -- a control
 *           inside a card takes `inner`, a field inside that takes `control`,
 *           because equal radii at two depths look like a mistake.
 *
 *   Grouping.  Rows live in one rounded container with hairlines between them,
 *           rather than as separate floating cards. `Divider` is that line and
 *           it draws in `colors.border`.
 *
 *   Restraint in motion.  Short, soft, never bouncy. A press is a scale, not a
 *           colour flash.
 */
export const oneui = {
  radius: {
    card: 20,      // the grouped container
    inner: 14,     // a control sitting inside one
    control: 10,   // a field or small tile
    pill: 999,
    sheet: 24,
  },

  /** The band of air a large-title screen opens with. */
  headroom: 12,

  /** Scroll distance, in dp, over which the large title becomes the bar title. */
  collapse: 56,

  /** The height of the compact bar the title collapses into. */
  barHeight: 52,

  /*
   * The navy band above the bar, added on top of the status-bar inset.
   *
   * It does two things. It gives the chrome a brand edge, so a screen of white
   * cards on a light page is anchored by something rather than fading into the
   * top of the display -- the same job the console's charcoal top bar does.
   * And it is what the light status-bar icons are drawn against: App.jsx asks
   * for `style="light"`, which was white-on-white over a white bar, so on the
   * portal screens the clock and the battery were invisible. It draws in
   * `sidebarColors.surface`, and white on that is 15.63:1.
   *
   * 3dp rather than 0 so the band survives a device that reports no top inset
   * at all; where there is an inset, this is the sliver of navy below it.
   */
  topBand: 3,

  motion: { fast: 160, base: 240, slow: 340 },

  /** A press is a scale. 0.97 is felt rather than seen, which is the point. */
  pressScale: 0.97,

  sidebar: {
    /** Icons only. Still a legal touch target at this width. */
    rail: 68,
    /** Icons and labels. */
    full: 248,
    /** Below this screen width the expanded sidebar covers the content
     *  instead of pushing it, because pushing it leaves nothing readable. */
    overlayBelow: 700,
  },
};

/*
 * The sidebar's own palette.
 *
 * Darker than the hero navy on purpose: the sidebar is a permanent chrome
 * surface sitting beside content, and at hero navy it competes with the page
 * instead of framing it. It is the role the console's charcoal chrome plays,
 * in this app's hue.
 *
 * These three were re-measured during the restyle rather than changed by it;
 * the figures recorded here before were each about 0.1 out.
 *
 *   sidebarInk on sidebar        #e8f0f8 on #0d2440   13.58:1  AAA
 *   sidebarInkMuted on sidebar   #8fb0d4 on #0d2440    6.94:1  AA
 *   sidebarHeading on sidebar    #6f91b6 on #0d2440    4.76:1  AA
 *   onTeal on teal (active row)  #ffffff on #17807d    4.75:1  AA
 */
export const sidebarColors = {
  surface: '#0d2440',
  active: colors.teal,
  activePressed: colors.tealPressed,
  hover: '#16355a',
  ink: '#e8f0f8',
  inkMuted: '#8fb0d4',
  heading: '#6f91b6',
  divider: '#1b3d64',
};
