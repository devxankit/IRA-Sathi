# Frontend Progress Log

## Snapshot — 2025-11-11

- **Project**: `Frontend/` (Vite + React 19 + Tailwind CSS v4)
- **Purpose**: ECommerce for Agriculture products + Super Admin console for agriculture commerce marketplace
- **Current Entry Point**: `src/App.jsx` switches between E-Commerce and admin console via in-app state toggle

---

## Current Project Structure (high-level)

- `src/components/` – Global shared components (`Button`, `Card`, `Navbar`, `Footer`, etc.)
- `src/index.css` – Tailwind v4 directives + custom base styles (light green/brown palette, global typography, utility classes)
- `src/modules/Admin/`
  - `App.jsx` – Admin shell managing in-module navigation
  - `context/` – `AdminContext.jsx` (filters + tenant state scaffold)
  - `components/` – Admin-only UI atoms (sidebar, metric cards, data table, progress list, timeline, layout, etc.)
  - `pages/` – Screen implementations for Dashboard, Products, Vendors, Sellers, Users, Orders, Finance, Analytics
  - `services/adminData.js` – Mock data powering admin UI placeholders
- `src/lib/cn.js` – Utility for conditional class merging

---

## Implementation Timeline

### Tailwind Setup & Theming
1. **Initial configuration**  
   - Added Tailwind directives in `src/index.css` and Vite plugin (`vite.config.js`).  
   - Provided initial theme tokens (`tailwind.config.js`) and global styles (body background radial gradient, link colors, reusable `.card-surface`, `.badge-brand`).

2. **Palette adjustments**  
   - Shifted theme to agriculture-friendly tones (subtle greens/browns, accent orange).  
   - Updated global CSS to reference Tailwind theme tokens (resolved runtime errors by switching to raw HSL values when Tailwind v4 `theme()` helper rejected lookups).

3. **Errors encountered & fixes**  
   - `Could not resolve value for theme function: theme(colors.surface.DEFAULT)` → Tailwind v4 renamed lookups; replaced with direct HSL colors.  
   - `@apply` warnings in `index.css` (Tailwind v4 restrictions) → Converted `@apply` usage to vanilla CSS properties.

### Global Component Library
- Introduced shared `Button`, `Card`, `FeatureGrid`, `FAQAccordion`, `Footer`, `Navbar` using new palette, focus rings, responsive behavior, and subtle shadows/animations.
- Replaced Vite starter content in `src/App.jsx` with marketing landing page demonstrating new components.

### Admin Module
1. **Module scaffolding (`src/modules/Admin/`)**
   - Context: `AdminContext.jsx` with placeholder filters and tenant state.
   - Layout: `AdminLayout.jsx` (collapsible sidebar, sticky header, exit button).
   - Sidebar: `Sidebar.jsx` with iconography and description for each workflow section.
   - Reusable atoms: `MetricCard`, `StatusBadge`, `DataTable`, `FilterBar`, `ProgressList`, `Timeline`.
   - Sample data: `services/adminData.js` to mimic analytics, finance, inventory, vendor/seller tables, etc.

2. **Page implementations**
   - Dashboard, Products, Vendors, Sellers, Users, Orders, Finance, Analytics: each page mirrors the user-provided admin flow steps with tailored cards, tables, progress indicators, and timelines.

3. **Integration**
   - `src/modules/Admin/index.js` exports `AdminApp` and context helpers.
   - `src/App.jsx` now toggles between marketing site and admin console via local state (`Launch Admin Console` button + `Exit Admin` control).

### Dependencies & Tooling
- Added `lucide-react` icons in UI components (reminder: run `npm install lucide-react`; install command previously declined).
- Ensured ESLint passes (no outstanding lint issues after adjustments).

---

## Known Issues / Outstanding Actions

- **Dependency install pending**: `lucide-react` required for admin icon set; run `npm install lucide-react` in `Frontend/` before building.
- **Routing**: Current admin toggle is state-based. For URL routes (e.g., `/admin`), integrate `react-router-dom`.
- **Data wiring**: Replace mock data in `services/adminData.js` with live API services when backend is ready.
- **Authentication**: Admin entry currently bypasses auth; integrate real auth guards.

---

## Useful Commands

- `npm install` (plus `npm install lucide-react`)
- `npm run dev`
- `npm run build`
- `npm run lint`

---

## Error History (for reference)

1. Tailwind CLI missing (`npx tailwindcss init -p`)  
   - **Cause**: Tailwind 4 removed CLI binary.  
   - **Fix**: Skip CLI init; manual config created instead.

2. Tailwind theme resolution errors (`theme(colors.surface.DEFAULT)` / `theme(colors.surface)`)  
   - **Cause**: Tailwind v4 plugin does not expose nested color tokens in CSS `theme()` helper.  
   - **Fix**: Replaced theme references with explicit HSL values; removed `@apply` from global CSS.

3. Lint warnings (`focus-visible:outline` duplicates)  
   - **Fix**: Switched to `focus-visible:ring` utilities to avoid redundant properties.

4. Missing `lucide-react` module  
   - **Fix**: Added dependency to `package.json`; installation still pending.

---

## Next Steps / Recommendations

- Install missing dependencies and rerun `npm run dev` to verify admin console.
- Introduce routing and authentication layers.  
- Begin hooking page-level actions to backend services (product CRUD, vendor approvals, etc.).

---

## Vendor Dashboard

### Overview

The Vendor Dashboard is a mobile-first, smartphone-optimized interface designed for vendors managing fertilizer stock, orders, credit/loans, and business performance. The design prioritizes simplicity and accessibility, using plain language to ensure users with limited technical knowledge can easily navigate and understand the system.

**Location**: `Frontend/src/modules/Vendor/`

### Design Philosophy

The dashboard follows a **mobile-first, app-like design** approach that prioritizes:
- **Smartphone-first responsiveness**: All layouts are optimized for mobile devices (max-width: 420px) with desktop responsiveness as secondary
- **Accessibility**: Technical terminology has been replaced with simple, everyday language
- **Visual hierarchy**: Clear information architecture with progressive disclosure
- **Performance**: Optimized animations and transitions using CSS transforms and will-change properties
- **Native app feel**: Fixed header with scroll-based collapse, bottom navigation, and sheet-based modals

### Design Pattern

The dashboard implements a **Component-Based Architecture** with the following patterns:

1. **Container/Presentational Pattern**:
   - `VendorDashboard.jsx` - Main container managing state and navigation
   - View components (`OverviewView`, `InventoryView`, `OrdersView`, `CreditView`, `ReportsView`) - Presentational components

2. **Context API Pattern**:
   - `VendorContext.jsx` - Global state management using React Context and useReducer
   - Provides authentication state, profile data, language preferences

3. **Custom Hooks Pattern**:
   - `useButtonAction` - Manages action panel state
   - `useToast` - Toast notification system
   - `useVendorState` / `useVendorDispatch` - Context accessors

4. **Compound Component Pattern**:
   - `MobileShell` - Wraps header, content, and bottom navigation
   - `ButtonActionPanel` - Modal panel for various actions
   - `MenuList` - Navigation menu with items

5. **Search Pattern**:
   - Global search with catalog-based indexing
   - Keyword-based fuzzy search with scoring algorithm
   - Smooth scroll navigation to search results

### Color System

The dashboard uses a **sophisticated green-based palette** with agricultural themes:

#### Primary Colors (CSS Variables)
```css
--vendor-green-600: #1b8f5b  /* Deep forest green */
--vendor-green-500: #2a9d61  /* Primary brand green */
--vendor-green-300: #6bc48f  /* Light accent green */
--vendor-brown-600: #9b6532  /* Earth brown */
--vendor-brown-400: #b07a45  /* Light brown */
--vendor-cream: #f9f6ef      /* Warm cream background */
--vendor-ink: #172022        /* Dark text color */
```

#### Background Gradients
- **Shell Background**: `linear-gradient(180deg, #fbfefb 0%, #f1f4ed 60%, #f4f1ea 100%)` - Subtle vertical gradient from white to cream
- **Header Background**: `linear-gradient(180deg, rgba(220, 237, 225, 0.95), rgba(240, 248, 242, 0.98), rgba(248, 252, 249, 1))` - Light green gradient with backdrop blur
- **Bottom Nav**: `linear-gradient(140deg, rgba(255, 255, 255, 0.95), rgba(240, 248, 242, 0.98))` - Semi-transparent white to green

#### Card Gradients
- **Hero Cards**: Multi-stop gradients using green tones (150deg angle)
- **Status Cards**: `linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 240, 0.95))` - White to light green
- **Action Cards**: Color-coded gradients:
  - Green: `rgba(16, 185, 129, 0.22)` to `rgba(16, 185, 129, 0.1)`
  - Orange: `rgba(251, 191, 36, 0.26)` to `rgba(251, 191, 36, 0.14)`
  - Teal: `rgba(45, 212, 191, 0.26)` to `rgba(56, 189, 248, 0.18)`

#### Shadow System
- **Header Shadow**: `0 4px 16px -8px rgba(34, 94, 65, 0.15)` - Subtle green-tinted shadow
- **Card Shadows**: `0 20px 44px -30px rgba(16, 44, 30, 0.38)` - Deep, soft shadows
- **Bottom Nav Shadow**: `0 -4px 24px -8px rgba(15, 23, 42, 0.2)` - Upward shadow

### Typography

**Font Family**: Manrope (Google Fonts)
- Weights: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

**Font Sizes**:
- Header Title: `0.95rem` (15.2px) - Weight 700
- Header Subtitle: `0.72rem` (11.5px) - Weight 500, Uppercase
- Hero Title: `1.85rem` (29.6px) - Weight 700
- Section Titles: `0.92rem` (14.7px) - Weight 600
- Body Text: `0.72rem - 0.9rem` (11.5px - 14.4px)
- Small Text: `0.62rem - 0.68rem` (9.9px - 10.9px)

**Letter Spacing**:
- Headers: `0.01em - 0.04em`
- Uppercase Labels: `0.08em`
- Body: `-0.01em to 0.05em`

### Design Details & Polish

#### 1. **Glassmorphism Effects**
- Header uses `backdrop-filter: blur(10px)` for frosted glass effect
- Cards have semi-transparent backgrounds with blur
- Overlay modals use `bg-black/20 backdrop-blur-sm`

#### 2. **Radial Glow Effects**
- Header glow: `radial-gradient(circle, rgba(152, 187, 161, 0.15), transparent 72%)` with 12px blur
- Card decorative glows positioned absolutely with blur filters
- Creates depth and visual interest

#### 3. **Border Radius System**
- Small elements: `12px - 14px` (buttons, badges)
- Medium cards: `18px - 20px` (service cards, metric cards)
- Large cards: `24px - 28px` (hero cards, status cards)
- Pills: `999px` (chips, tags)
- Header: `26px` bottom radius

#### 4. **Micro-interactions**
- Header collapse on scroll (hysteresis pattern: 30px down, 20px up)
- Button hover: `translateY(-2px)` with opacity change
- Icon buttons: Smooth transform transitions
- Sheet modals: Slide-in animations with `cubic-bezier(0.4, 0, 0.2, 1)`

#### 5. **Progress Indicators**
- Circular progress rings using SVG with stroke-dasharray
- Linear progress bars with gradient fills
- Color-coded status indicators (Healthy/Low/Critical)

#### 6. **Card Design Elements**
- Decorative `::after` pseudo-elements for depth
- Inset borders: `inset 0 0 0 1px rgba(34, 94, 65, 0.1)`
- Multi-layered shadows for elevation
- Gradient overlays for visual hierarchy

#### 7. **Status Color Coding**
- **Success/Healthy**: Green tones (`rgba(43, 118, 79, ...)`)
- **Warning/Low**: Orange/amber tones (`rgba(251, 191, 36, ...)`)
- **Critical/Urgent**: Red tones (warn variants)
- **Info/Teal**: Teal/cyan tones (`rgba(33, 150, 173, ...)`)

### Layout & Structure

#### Overall Layout Hierarchy
```
vendor-shell (max-width: 420px, centered)
├── vendor-shell-header (fixed, z-index: 30)
│   ├── vendor-shell-header__glow (decorative)
│   ├── vendor-shell-header__controls
│   │   ├── vendor-shell-header__brand (logo)
│   │   └── vendor-shell-header__actions (search, menu)
│   └── vendor-shell-header__info (title, subtitle)
├── vendor-shell-content (flex: 1, padding-top: calc(1.5rem + 115px))
│   └── space-y-6 (vertical spacing between sections)
│       ├── OverviewView
│       ├── InventoryView
│       ├── OrdersView
│       ├── CreditView
│       └── ReportsView
└── vendor-shell-bottom-nav (fixed, z-index: 25)
    └── BottomNavItem[] (5 navigation items)
```

#### Section Structure

**Overview Section**:
- Hero card with wallet balance and stats
- Shortcuts rail (horizontal scrollable)
- Recent activity timeline
- Snapshot metrics grid
- Quick actions grid

**Inventory Section**:
- Hero header with action buttons
- Top stats grid (2 columns)
- Stock snapshot metrics (4 columns)
- Alerts & follow-ups grid
- Product cards list (vertical stack)

**Orders Section**:
- Hero header with filter chips
- Dynamic stats based on filter
- Orders list with status tracker
- Fallback logistics card

**Credit Section**:
- Status card with circular progress
- Summary metrics grid (4 columns)
- Usage progress card
- Management action card
- Penalty timeline

**Reports Section**:
- Summary card with earnings
- Performance metrics grid
- Tabbed analytics (Revenue, Performance, Trends, Insights)
- Top sellers list

### Spacing System

#### Vertical Spacing
- **Section gaps**: `1.5rem` (24px) - Standard spacing between major sections
- **Card internal gaps**: `1.1rem - 1.4rem` (17.6px - 22.4px)
- **Element gaps**: `0.75rem - 0.9rem` (12px - 14.4px)
- **Tight gaps**: `0.35rem - 0.45rem` (5.6px - 7.2px)
- **Header spacing**: `1.5rem` top margin for credit-status and reports-summary sections

#### Horizontal Spacing
- **Shell padding**: `1.25rem` (20px) - Standard horizontal padding
- **Card padding**: `1.4rem - 1.5rem` (22.4px - 24px)
- **Compact padding**: `0.75rem - 1rem` (12px - 16px)
- **Negative margins**: `-0.65rem` for full-width sections

#### Content Padding
- **Top padding**: `calc(1.5rem + 115px)` - Accounts for fixed header height
- **Bottom padding**: `calc(1.5rem + 80px)` - Accounts for bottom navigation
- **Header padding**: `0.75rem 1.25rem 0.5rem` (top, sides, bottom)

### Component Architecture

#### Key Components
1. **MobileShell**: Main layout wrapper with fixed header, scrollable content, bottom nav
2. **BottomNavItem**: Navigation item with icon, label, active state
3. **MenuList**: Side drawer menu with navigation items
4. **ButtonActionPanel**: Modal panel for various actions (update stock, confirm delivery, etc.)
5. **ToastNotification**: Toast system for user feedback

#### State Management
- **Context API**: Global vendor state (auth, profile, language)
- **Local State**: Tab navigation, search, modals, filters
- **Custom Hooks**: Encapsulated state logic for actions and toasts

#### Data Flow
- Mock data from `vendorDashboard.js` service
- State updates through Context dispatch
- Action panels trigger toast notifications
- Search catalog uses memoized keyword indexing

### Responsive Behavior

#### Breakpoints
- **Primary**: Mobile-first (max-width: 420px)
- **Small screens**: `@media (max-width: 360px)` - Grid adjustments for credit card
- **Desktop**: Inherits mobile styles (centered, max-width maintained)

#### Adaptive Features
- Header collapses on scroll (saves vertical space)
- Horizontal scrollable sections (shortcuts, services)
- Sheet modals slide in from right
- Bottom navigation adapts to safe-area-inset

### Performance Optimizations

1. **CSS Optimizations**:
   - `will-change` properties for animated elements
   - `transform` and `opacity` for GPU-accelerated animations
   - `backdrop-filter` with hardware acceleration

2. **React Optimizations**:
   - `useMemo` for search catalog and tab labels
   - Conditional rendering for modals (mount/unmount)
   - `requestAnimationFrame` for scroll handlers

3. **Animation Performance**:
   - Cubic-bezier easing: `cubic-bezier(0.4, 0, 0.2, 1)`
   - Transition durations: `0.2s - 0.3s`
   - Passive scroll listeners

### Accessibility Features

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support (Enter, Escape)
- Focus management for modals
- Screen reader support (sr-only class)
- Color contrast compliance

### File Structure

```
Frontend/src/modules/Vendor/
├── components/
│   ├── MobileShell.jsx          # Main layout wrapper
│   ├── BottomNavItem.jsx        # Navigation item
│   ├── MenuList.jsx             # Side menu
│   ├── ButtonActionPanel.jsx    # Action modal
│   ├── ToastNotification.jsx    # Toast system
│   └── icons/                   # Icon components
├── pages/
│   └── vendor/
│       └── VendorDashboard.jsx  # Main dashboard component
├── context/
│   └── VendorContext.jsx        # Global state management
├── services/
│   └── vendorDashboard.js      # Mock data service
├── hooks/
│   └── useButtonAction.js      # Action panel hook
└── vendor.css                   # All dashboard styles (4303 lines)
```

### Technical Stack

- **React 19**: Component framework
- **CSS Modules**: Scoped styling (4303 lines of custom CSS)
- **Context API**: State management
- **Custom Hooks**: Reusable logic
- **Manrope Font**: Typography
- **SVG Icons**: Custom icon components
- **CSS Gradients**: Visual effects
- **Backdrop Filters**: Glassmorphism

