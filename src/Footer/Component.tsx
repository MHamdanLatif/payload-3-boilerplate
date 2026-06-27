import Link from 'next/link'
import React from 'react'
import { Instagram, Facebook, Phone, Mail, MapPin, ArrowUpRight } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'

const MAPS_URL = 'https://maps.app.goo.gl/RTVU2EMN8bzqwbQL9'
const WHATSAPP_URL = 'https://wa.me/923363528333'
const EMAIL = 'info.lateefproperties@gmail.com'

type FooterLinkItem = { label: string; href: string; external?: boolean }

const QUICK_LINKS: FooterLinkItem[] = [
  { label: 'About', href: '/#about' },
  { label: 'Properties', href: '/properties' },
  { label: 'Blogs', href: '/blog' },
  { label: 'Services', href: '/#services' },
  { label: 'Builder', href: 'https://www.lateefbuilders.pk/', external: true },
  { label: 'Contact', href: '/#contact' },
]

const PROJECTS = [
  { label: 'Pre-launch projects', href: '/properties?status=Pre-launch' },
  { label: 'Under-construction', href: '/properties?status=Under+Construction' },
  { label: 'Ready-to-move flats', href: '/properties?status=Ready' },
  { label: 'Commercial property', href: '/properties?propertyType=Commercial' },
  { label: 'Off-market resale', href: '/#contact' },
]

const SOCIAL = [
  { icon: Instagram, href: 'https://instagram.com/lateefproperties', label: 'Instagram' },
  { icon: Facebook, href: 'https://facebook.com/lateefpropertiespk', label: 'Facebook' },
  { icon: WhatsAppIcon, href: WHATSAPP_URL, label: 'WhatsApp' },
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand-deep text-ivory">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="container py-20">
        {/* Top — display headline */}
        <div className="grid grid-cols-1 gap-14 border-b border-ivory/10 pb-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              MODERN MARKETING ARM
            </span>
            <h3 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-6xl">
              Karachi&rsquo;s authorised desk for{' '}
              <span className="italic text-gold">new launches</span> and ready-to-move resale.
            </h3>
          </div>
          <div className="lg:col-span-5 lg:pl-8">
            <p className="text-sm leading-relaxed text-ivory/75">
              Authorised marketing agency for Karachi&rsquo;s leading developers.
              Pre-launch allocations, ready-to-move resale and off-market deals
              across Gulshan-e-Iqbal, Gulistan-e-Johar, Scheme 33, DHA, Clifton,
              M.A. Jinnah Road, Jinnah Avenue and Malir.
            </p>
            <a
              href="/#contact"
              className="group mt-6 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-gold transition-colors hover:text-ivory"
            >
              Begin a conversation
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>

        {/* Middle — link columns */}
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-4">
          <FooterCol heading="Navigate">
            {QUICK_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} external={l.external}>
                {l.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol heading="Developments">
            {PROJECTS.map((p) => (
              <FooterLink key={p.label} href={p.href}>
                {p.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol heading="Contact">
            <a
              href="tel:+923363528333"
              className="group flex items-center gap-2 text-sm text-ivory/70 transition-colors hover:text-gold"
            >
              <Phone className="h-3.5 w-3.5 text-gold/70" />
              +92-3363-LATEEF
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="group flex min-w-0 items-start gap-2 text-sm text-ivory/70 transition-colors hover:text-gold"
            >
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/70" />
              <span className="break-all">{EMAIL}</span>
            </a>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 text-sm text-ivory/70 transition-colors hover:text-gold"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 text-gold/70" />
              <span>
                Ground Floor Office, Four Seasons Apartment,
                <br />
                Block 16, Gulshan-e-Iqbal, Karachi
              </span>
            </a>
          </FooterCol>

          <FooterCol heading="Neighbourhoods">
            <FooterLink href="/locations/gulshan-e-iqbal">Gulshan-e-Iqbal</FooterLink>
            <FooterLink href="/locations/gulistan-e-johar">Gulistan-e-Johar</FooterLink>
            <FooterLink href="/locations/scheme-33">Scheme 33</FooterLink>
            <FooterLink href="/locations/dha">DHA</FooterLink>
            <FooterLink href="/locations/clifton">Clifton</FooterLink>
            <FooterLink href="/locations/jinnah-avenue">Jinnah Avenue</FooterLink>
            <FooterLink href="/locations/ma-jinnah-road">M.A. Jinnah Road</FooterLink>
            <FooterLink href="/locations/malir">Malir</FooterLink>
          </FooterCol>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col items-start justify-between gap-6 border-t border-ivory/10 pt-8 sm:flex-row sm:items-center">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-xl tracking-tight text-ivory">Lateef</span>
            <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-gold" />
            <span className="font-serif text-xl tracking-tight text-ivory">Properties</span>
          </div>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ivory/55">
            <span>© {new Date().getFullYear()} Lateef Properties · Karachi</span>
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            <Link href="/privacy" className="transition-colors hover:text-gold">
              Privacy Policy
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="transition-colors hover:text-gold">
              Terms of Use
            </Link>
          </p>

          <div className="flex items-center gap-3">
            {SOCIAL.map(({ icon: Icon, href, label }) => (
              <Link
                key={label}
                href={href}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ivory/15 text-ivory/60 transition-all duration-300 hover:border-gold hover:text-gold"
              >
                <Icon className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-5 text-gold">{heading}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group inline-flex w-fit items-center gap-1.5 text-sm text-ivory/70 transition-colors hover:text-gold"
    >
      <span>{children}</span>
      {external && <ArrowUpRight className="h-3 w-3 opacity-70" />}
    </Link>
  )
}
