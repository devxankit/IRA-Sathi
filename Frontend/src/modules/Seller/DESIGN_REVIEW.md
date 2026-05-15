# Design Review: User Dashboard & Vendor Dashboard

## Design Principles & Patterns

### 1. **Smartphone-First Approach**
- Maximum width: **420px** (mobile viewport)
- All layouts optimized for vertical scrolling
- Touch-friendly button sizes (minimum 44px)
- Bottom navigation bar for primary actions
- Fixed header with scroll-based compact mode

### 2. **Color Palette**

#### User Dashboard Colors:
- **Primary Green**: `#1b8f5b` (--user-green-600)
- **Secondary Green**: `#2a9d61` (--user-green-500)
- **Light Green**: `#6bc48f` (--user-green-300)
- **Brown Accent**: `#9b6532` (--user-brown-600)
- **Cream Background**: `#f9f6ef` (--user-cream)
- **Text Color**: `#172022` (--user-ink)
- **Background Gradient**: `linear-gradient(180deg, #fbfefb 0%, #f1f4ed 60%, #f4f1ea 100%)`

#### Vendor Dashboard Colors:
- **Primary Green**: `#1b8f5b` (--vendor-green-600)
- **Secondary Green**: `#2a9d61` (--vendor-green-500)
- **Light Green**: `#6bc48f` (--vendor-green-300)
- **Brown Accent**: `#9b6532` (--vendor-brown-600)
- **Cream Background**: `#f9f6ef` (--vendor-cream)
- **Text Color**: `#172022` (--vendor-ink)
- **Background Gradient**: Same as User Dashboard

### 3. **Typography**
- **Font Family**: 'Manrope', system-ui, sans-serif
- **Font Weights**: 400, 500, 600, 700
- **Heading Sizes**: 
  - Hero titles: 1.85rem (29.6px)
  - Section titles: 1rem (16px) to 1.125rem (18px)
  - Body text: 0.85rem (13.6px) to 0.9rem (14.4px)
  - Small text: 0.68rem (10.88px) to 0.75rem (12px)

### 4. **Component Patterns**

#### **Hero Cards**
- Large gradient cards with rounded corners (28px border-radius)
- Contains key metrics and welcome message
- Background: `linear-gradient(150deg, rgba(43, 118, 79, 0.578), rgba(67, 160, 110, 0.51), rgba(107, 196, 143, 0.442))`
- Shadow: `0 24px 48px -30px rgba(13, 38, 24, 0.32)`
- Includes decorative radial gradient overlays

#### **Stat Cards**
- Grid layout: `repeat(auto-fit, minmax(150px, 1fr))`
- Border-radius: 18px to 20px
- Background: `rgba(255, 255, 255, 0.9)` with subtle gradients
- Border: `1px solid rgba(34, 94, 65, 0.15)`
- Shadow: `0 18px 38px -28px rgba(13, 38, 24, 0.35)`

#### **Service/Shortcut Cards**
- Horizontal scrolling rail
- Card size: `minmax(128px, 1fr)`
- Icon containers: 38px × 38px with rounded corners (14px)
- Background: `linear-gradient(160deg, #ffffff 0%, #f0f8f3 85%)`
- Dot indicators for pagination

#### **Activity/Transaction Items**
- List layout with avatar circles (36px)
- Avatar background: `linear-gradient(145deg, rgba(107, 196, 143, 0.32), rgba(28, 124, 80, 0.26))`
- Border-radius: 20px
- Positive amounts: green color
- Negative amounts: brown color

#### **Metric Cards**
- Icon + text layout
- Icon size: 36px × 36px
- Progress bars with gradient fills
- Uppercase labels with letter-spacing

#### **Callout/Action Cards**
- Grid: `repeat(auto-fit, minmax(170px, 1fr))`
- Color variants: success (green), warn (orange), teal (blue-green)
- Icon + label + description structure

### 5. **Button Behaviors**

#### **Primary Buttons**
- Background: `linear-gradient(145deg, var(--vendor-green-600), var(--vendor-green-500))`
- Border-radius: 999px (pill shape)
- Font: 0.72rem, uppercase, letter-spacing: 0.08em
- Hover: `translateY(-1px)` with enhanced shadow
- Active: `translateY(0)`

#### **Secondary Buttons**
- Background: `rgba(255, 255, 255, 0.85)`
- Border: `1px solid rgba(43, 118, 79, 0.22)`
- Color: `var(--vendor-green-600)`
- Hover: slight lift and background brightening

#### **Icon Buttons**
- Size: 42px × 42px
- Border-radius: 16px
- Transparent background
- Hover: `translateY(-2px)` with opacity change

### 6. **Navigation Patterns**

#### **Bottom Navigation**
- Fixed position at bottom
- Background: `linear-gradient(140deg, rgba(255, 255, 255, 0.95), rgba(240, 248, 242, 0.98))`
- Backdrop blur: 20px
- Border-top: `1px solid rgba(34, 94, 65, 0.08)`
- Active state: gradient background with shadow

#### **Header**
- Fixed position at top
- Compact mode on scroll (hides subtitle)
- Background: `linear-gradient(180deg, rgba(220, 237, 225, 0.95), rgba(240, 248, 242, 0.98), rgba(248, 252, 249, 1))`
- Backdrop blur: 10px
- Border-radius: 0 0 26px 26px

### 7. **Sheet/Modal Patterns**

#### **Search Sheet**
- Full-screen overlay with blur
- Panel slides from top
- Border-radius: 0 0 28px 28px
- Background: `rgba(255, 255, 255, 0.98)`
- Animation: 0.32s ease

#### **Activity Sheet**
- Slides from bottom
- Border-radius: 28px 28px 0 0
- Max-height: 85vh
- Scrollable content area

### 8. **Spacing & Layout**
- Section gap: `1.5rem` to `1.75rem`
- Card padding: `1rem` to `1.5rem`
- Grid gaps: `0.75rem` to `0.85rem`
- Content padding: `1.25rem` (20px)

### 9. **Status Indicators**

#### **Chips/Badges**
- Border-radius: 999px (pill)
- Font: 0.65rem to 0.72rem, uppercase
- Letter-spacing: 0.08em
- Color variants:
  - Success: green background with green text
  - Warn: orange/brown background with brown text
  - Teal: blue-green background with teal text

#### **Progress Indicators**
- Height: 6px to 8px
- Border-radius: 999px
- Background: `rgba(34, 94, 65, 0.12)`
- Fill: `linear-gradient(90deg, rgba(43, 118, 79, 0.85), rgba(43, 118, 79, 0.65))`

### 10. **Functional Components**

#### **Dynamic Components:**
- Scroll-based header compact mode
- Horizontal scrolling service rails with pagination dots
- Expandable activity sheets
- Search with real-time filtering
- Toast notifications (success, error, warning, info)
- Bottom sheet modals for actions

#### **Interactive Elements:**
- Tab navigation with active states
- Filter chips with active/inactive states
- Expandable sections
- Swipeable carousels
- Pull-to-refresh patterns (implied)

### 11. **Design Evolution Notes**

#### **User Dashboard:**
- Focus on product discovery and shopping
- Large product images and cards
- Category-based navigation
- Shopping cart and favorites
- Order tracking

#### **Vendor Dashboard:**
- Focus on business operations
- Metric-heavy displays
- Action-oriented interface
- Status tracking (orders, inventory, credit)
- Performance analytics

### 12. **Seller Dashboard Requirements**

Based on the Seller role description, the dashboard should include:

1. **Overview View:**
   - Total users referred
   - Total purchase amount via Seller ID
   - Monthly sales target progress
   - Wallet/cashback balance
   - Latest admin announcements preview

2. **Referrals View:**
   - List of users referred
   - Purchase history per user
   - Commission earned per referral

3. **Wallet View:**
   - Current balance
   - Transaction history
   - Withdrawal requests
   - Commission breakdown

4. **Announcements View:**
   - Admin announcements
   - Policy updates
   - Target changes
   - System notifications

### 13. **CSS Naming Convention**

Following the established pattern:
- Module prefix: `seller-` (e.g., `seller-shell`, `seller-hero`)
- BEM-like structure: `seller-component__element--modifier`
- Common classes in `seller.css` for reuse
- View-specific classes in component files if needed

---

## Next Steps

1. Build OverviewView component
2. Build ReferralsView component
3. Build WalletView component
4. Build AnnouncementsView component
5. Add common styles to seller.css
6. Test responsive behavior
7. Ensure consistency with User/Vendor dashboards

