# Easing Curves & Interpolation Reference

## 1. Mathematical Formulas ($t \in [0, 1]$)

| Curve Name | Mathematical Formula | Usage |
| :--- | :--- | :--- |
| **Linear** | $f(t) = t$ | Infinite loops, rotating spinners, marquee tickers |
| **Ease In Quad** | $f(t) = t^2$ | Subtle exit acceleration |
| **Ease Out Quad** | $f(t) = 1 - (1 - t)^2$ | Gentle entrance |
| **Ease Out Cubic** | $f(t) = 1 - (1 - t)^3$ | Standard natural UI card entry |
| **Ease Out Quart** | $f(t) = 1 - (1 - t)^4$ | Snappy, crisp modal / overlay entry |
| **Ease In Out Cubic**| $f(t) = 4t^3$ if $t < 0.5$ else $1 - (-2t + 2)^3 / 2$ | Smooth repositioning, camera moves |
| **Ease Out Back** | $f(t) = 1 + (c_1 + 1)(t-1)^3 + c_1(t-1)^2$ ($c_1 \approx 1.70158$) | Playful bounce, pop-in badges, buttons |
| **Ease Out Elastic**| $f(t) = 2^{-10t} \cdot \sin((t \cdot 10 - 0.75) \cdot \frac{2\pi}{3}) + 1$ | Springy jelly effect |

---

## 2. Cubic-Bezier Coordinates for Web & CSS

```css
/* Quick & responsive UI snap */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

/* Smooth natural motion */
--ease-out-cubic: cubic-bezier(0.33, 1, 0.68, 1);

/* Overshoot entrance */
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Subtle camera / slide panning */
--ease-in-out-smooth: cubic-bezier(0.65, 0, 0.35, 1);
```

