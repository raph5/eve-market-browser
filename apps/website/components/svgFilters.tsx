
export default function SvgFilters() {
  return (
    <svg display="none">
      <defs>
        <filter id="whiteGlow" height="300%" width="300%" x="-75%" y="-75%">
          
          {/* Thicken out the original shape */}
          <feMorphology operator="dilate" radius="4" in="SourceAlpha" result="thicken" />
          
          {/* Use a gaussian blur to create the soft blurriness of the glow */}
          <feGaussianBlur in="thicken" stdDeviation="10" result="blurred" />
          
          {/* Change the colour */}
          <feFlood floodColor="rgb(0,186,255)" result="glowColor" />
          
          {/* Color in the glows */}
          <feComposite in="glowColor" in2="blurred" operator="in" result="softGlow_colored" />
          
          {/*	Layer the effects together */}
          <feMerge>
            <feMergeNode in="softGlow_colored"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}