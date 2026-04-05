# Cross Connect Design Conventions

This document outlines the visual and architectural conventions for the Cross Connect project.

## Core Principle: Information Density First

Prioritize **information density** over excessive whitespace. The interface should feel compact, efficient, and direct.

### Layout & Spacing
- **Hierarchy**: Avoid excessive hierarchy. Hierarchy can still be used to convey relationships between elements, but only if there's a clear function of the hierarchy.
- **Paddings**: Avoid large paddings. Prefer `p-2` or `p-3` for containers rather than `p-6` or higher.
- **Gaps**: Use tighter gaps between related elements. Use `gap-2` or `gap-3` where `gap-6` or `gap-8` might be standard in other apps.
- **Margins**: Keep vertical margins minimal between sections.
- **Header**: The main navigation should be compact. Horizontal padding (`px-3` or `px-4`) is preferred over wide margins.

### Typography
- **Scalability**: Font sizes should be readable but not oversized.
- **Tracking**: Use tight tracking for headings (`tracking-tighter` or `tracking-tight`) to maintain high-density visual flow.

### Interaction
- **Micro-animations**: Keep transitions fast (e.g., `duration-150` or `duration-200`) to maintain a snappy feel. Transitions should only be used as an affordance to help the user understand state changes, not for decoration.
- **Compact Components**: Cards and modals should contain information without unnecessary space.

## Core Principle: Mature Presentation

- **Avoid "cute" or "playful" design elements**: This should evoke a classic NY Times puzzle aesthetic. It should feel clean and timeless.
- **Fonts**: Use simple Sans Serif fonts.
- **Titles and Headers**: Headers can be all caps, but in cases where the the text is showing a user-submitted title or clue, it should respect the capitalization of the user submission. The only exception is that the text on the text on the tiles should be all-caps.
- **Use of color**: Primary interface should be black and white, with color used only to convey information and highlight attention.
- **Use of icons**: When icons are used, they should be simple, clean, and consistent. No color icons.
- **Avoid engagement bait**: Avoid using manipulative design patterns. This includes language that's overly enthusiastic or suggesting the user do something.

## Design target

- **Mobile**: The app should be fully functional on mobile devices as a primary platform. It should support all features down to iPhone SE (2nd Gen) size class (CSS pixels 375x667).
- **Browsers**: The app should be fully functional on latest versions of Chrome, Firefox, and Safari.
- **Platforms**: The app should be fully functional on macOS, Windows, iOS, and Android.
