import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSideURL } from '@/utilities/getURL'

const base = getServerSideURL().replace(/\/$/, '')
const EFFECTIVE_DATE = '21 May 2026'

export const metadata: Metadata = {
  title: 'Terms of Use | Lateef Properties',
  description:
    'The terms and conditions governing your use of the Lateef Properties website, lead enquiry forms, and marketing services.',
  alternates: { canonical: `${base}/terms` },
  robots: { index: true, follow: true },
}

export default function TermsOfUsePage() {
  return (
    <main className="bg-ivory pb-24 pt-32 md:pb-32 md:pt-40">
      <div className="container max-w-3xl">
        <header className="mb-12">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
            LEGAL
          </span>
          <h1 className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-[3.5rem]">
            Terms of Use
          </h1>
          <p className="mt-4 text-sm text-brand-deep/60">
            Effective: {EFFECTIVE_DATE}
          </p>
        </header>

        <article className="space-y-8 text-base leading-relaxed text-brand-deep/80 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-brand-deep [&_h2]:mt-12 [&_h2]:mb-3 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-brand-deep [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-gold [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-gold-hover [&_strong]:text-brand-deep [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_p]:my-3">
          <section>
            <p>
              These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of
              the Lateef Properties website at <strong>lateefproperties.com</strong> (the
              &ldquo;Site&rdquo;), our enquiry forms, and the marketing and advisory
              services we provide. By using the Site or submitting an enquiry, you
              accept these Terms.
            </p>
            <p>
              If you do not agree with any part of these Terms, do not use the Site.
            </p>
          </section>

          <section>
            <h2>1. About Lateef Properties</h2>
            <p>
              Lateef Properties is a real estate <strong>marketing agency</strong>{' '}
              based in Karachi, Pakistan. We market new-development real estate
              projects on behalf of authorised developers, and we facilitate
              introductions between buyers and sellers for ready-to-move properties.
            </p>
            <p>
              Lateef Properties is <strong>not</strong> a real estate developer,
              builder, contractor, or holder of property title. Any property featured
              on the Site is owned, developed, or offered by a separate third party
              (the developer or seller). We facilitate enquiries and viewings; we do
              not transact property ownership.
            </p>
          </section>

          <section>
            <h2>2. Information for Guidance Only</h2>
            <p>
              All property information published on the Site, including but not
              limited to <strong>prices, payment plans, unit sizes, floor plans,
              amenities, completion timelines, locations, and availability</strong>,
              is provided for general guidance only.
            </p>
            <p>
              Such information is sourced from developers and partners and may change
              without notice. <strong>You must independently verify all property
              details with the developer or seller before making any booking,
              payment, or commitment.</strong> Lateef Properties makes no warranty
              that any specific price, unit, or feature will be available on the
              terms shown on the Site at the time of your enquiry.
            </p>
            <p>
              Imagery (renders, elevations, photographs) is illustrative and may
              differ from the actual built product.
            </p>
          </section>

          <section>
            <h2>3. Enquiry Forms and Communications Consent</h2>
            <p>By submitting an enquiry form on the Site, you confirm that:</p>
            <ul>
              <li>
                The information you provided (name, phone, email, preferences) is
                accurate.
              </li>
              <li>
                You are at least 18 years of age and legally able to enter into binding
                agreements.
              </li>
              <li>
                You <strong>consent to be contacted</strong> by Lateef Properties and
                its authorised advisors by phone, SMS, WhatsApp, or email regarding
                your enquiry and related properties.
              </li>
              <li>
                You consent to your enquiry being routed to our CRM and, where
                relevant, shared with the specific property developer to whose
                project you enquired.
              </li>
            </ul>
            <p>
              You may withdraw consent and request to be removed from our contact list
              at any time by emailing{' '}
              <a href="mailto:info.lateefproperties@gmail.com">
                info.lateefproperties@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2>4. No Brokerage Liability</h2>
            <p>
              Any property transaction proceeds <strong>directly between you (the
              buyer) and the developer or seller</strong>. Lateef Properties is not
              a party to that transaction and is not liable for:
            </p>
            <ul>
              <li>The accuracy or completeness of representations made by the developer or seller</li>
              <li>The quality, condition, or suitability of any property</li>
              <li>Title defects, NOC issues, regulatory approvals, or document irregularities</li>
              <li>Delays in possession, handover, or completion</li>
              <li>Disputes between you and the developer or seller</li>
            </ul>
            <p>
              We strongly recommend that you engage your own legal counsel to review
              all transaction documents before signing.
            </p>
          </section>

          <section>
            <h2>5. Intellectual Property</h2>
            <p>
              The Site, including but not limited to text, design, graphics, logos,
              icons, photographs, software, and underlying source code, is owned by
              Lateef Properties or its licensors and is protected by Pakistani and
              international intellectual property laws.
            </p>
            <p>You may:</p>
            <ul>
              <li>View, print, or download Site content for personal, non-commercial use.</li>
            </ul>
            <p>You may not:</p>
            <ul>
              <li>Reproduce, republish, copy, or redistribute Site content without our prior written consent.</li>
              <li>Use scraping, crawling, or automated extraction tools without authorisation.</li>
              <li>Use our trademarks, brand name, or logo without prior written permission.</li>
              <li>Remove or modify any copyright or proprietary notices.</li>
            </ul>
          </section>

          <section>
            <h2>6. User Conduct</h2>
            <p>When using the Site, you agree not to:</p>
            <ul>
              <li>Provide false, misleading, or fraudulent information.</li>
              <li>Use any enquiry form for spam, harassment, or commercial solicitation.</li>
              <li>Attempt to access restricted areas (e.g. the admin panel) without authorisation.</li>
              <li>Interfere with the Site&rsquo;s normal operation, security, or integrity.</li>
              <li>Use the Site for any unlawful purpose under Pakistani or applicable law.</li>
            </ul>
          </section>

          <section>
            <h2>7. Third-Party Links and Services</h2>
            <p>
              The Site may link to third-party websites — including the parent
              company&rsquo;s website at{' '}
              <a
                href="https://www.lateefbuilders.pk/"
                target="_blank"
                rel="noopener noreferrer"
              >
                lateefbuilders.pk
              </a>
              , developer brochures, social media profiles, and Google Maps. We are
              not responsible for the content, availability, or policies of those
              third-party sites. Visit them at your own risk.
            </p>
          </section>

          <section>
            <h2>8. Disclaimers</h2>
            <p>
              The Site and its content are provided &ldquo;<strong>as is</strong>
              &rdquo; and &ldquo;<strong>as available</strong>&rdquo;. To the maximum
              extent permitted by applicable law, Lateef Properties disclaims all
              warranties, whether express, implied, statutory, or otherwise,
              including but not limited to:
            </p>
            <ul>
              <li>Warranties of merchantability, fitness for a particular purpose, or non-infringement.</li>
              <li>Warranties that the Site will be uninterrupted, error-free, or secure.</li>
              <li>Warranties regarding the accuracy, completeness, or timeliness of any property information.</li>
            </ul>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall
              Lateef Properties, its directors, employees, agents, or affiliates be
              liable for any indirect, incidental, special, consequential, or punitive
              damages, including but not limited to loss of profits, loss of data,
              loss of opportunity, or damage to reputation, arising from or relating
              to:
            </p>
            <ul>
              <li>Your use of, or inability to use, the Site.</li>
              <li>Any property transaction you enter into with a developer or seller.</li>
              <li>Reliance on any information published on the Site.</li>
              <li>Errors, omissions, or unavailability of the Site or its services.</li>
            </ul>
            <p>
              In all cases, our aggregate liability arising out of or relating to the
              Site shall not exceed PKR 10,000 or the equivalent in your local
              currency.
            </p>
          </section>

          <section>
            <h2>10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Lateef Properties, its
              directors, employees, and agents from any claim, loss, damage, or
              expense (including reasonable legal fees) arising from your breach of
              these Terms, your misuse of the Site, or your violation of any
              applicable law.
            </p>
          </section>

          <section>
            <h2>11. Governing Law and Jurisdiction</h2>
            <p>
              These Terms are governed by the laws of the Islamic Republic of
              Pakistan. Any dispute arising out of or in connection with these Terms
              or your use of the Site shall be submitted to the exclusive jurisdiction
              of the courts of Sindh, Karachi.
            </p>
            <p>
              For users located in the United Arab Emirates, nothing in these Terms
              excludes mandatory consumer protection rights available to you under UAE
              law.
            </p>
          </section>

          <section>
            <h2>12. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable, that
              provision shall be modified to the minimum extent necessary to make it
              enforceable, and the remaining provisions shall continue in full force.
            </p>
          </section>

          <section>
            <h2>13. Changes to These Terms</h2>
            <p>
              We may revise these Terms from time to time. Material revisions will be
              announced on this page with a revised &ldquo;Effective&rdquo; date.
              Continued use of the Site after a change constitutes acceptance of the
              revised Terms.
            </p>
          </section>

          <section>
            <h2>14. Contact</h2>
            <p>For any questions about these Terms, contact:</p>
            <ul>
              <li>
                Email:{' '}
                <a href="mailto:info.lateefproperties@gmail.com">
                  info.lateefproperties@gmail.com
                </a>
              </li>
              <li>
                Phone / WhatsApp:{' '}
                <a href="tel:+923363528333">+92-3363-LATEEF (+92 336 3528333)</a>
              </li>
              <li>
                Postal address: Ground Floor Office, Four Seasons Apartment, Block 16,
                Gulshan-e-Iqbal, Karachi, Pakistan.
              </li>
            </ul>
          </section>

          <section className="mt-16 rounded-2xl border border-brand-deep/10 bg-white p-6 shadow-luxe-sm md:p-8">
            <p className="eyebrow text-gold">Related</p>
            <p className="mt-3 text-sm text-brand-deep/70">
              See also:{' '}
              <Link href="/privacy" className="text-gold underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </article>
      </div>
    </main>
  )
}
