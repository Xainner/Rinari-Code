interface LogoProps {
  size?: number
  className?: string
  radius?: string
}

export default function Logo({ size = 40, className = '', radius = '' }: LogoProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center ${radius} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.png?v=2"
        alt=""
        className="size-full object-contain"
        style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.35))' }}
      />
    </div>
  )
}
