import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSideURL } from '@/utilities/getURL'

const base = getServerSideURL().replace(/\/$/, '')
const EFFECTIVE_DATE = '21 May 2026'

export const metadata: Metadata = {
  title: 'Privacy Policy | Lateef Properties',
  description:
    'How Lateef Properties collects, uses, shares, and protects personal information of website visitors and prospective clients.',
  alternates: { canonical: `${base}/privacy` },
  robots: { index: true, follow: true },
}

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-ivory pb-24 pt-32 md:pb-32 md:pt-40">
      <div className="container max-w-3xl">
        <header className="mb-12">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
            LEGAL
          </span>
          <h1 className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-[3.5rem]">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-brand-deep/60">
            Effective: {EFFECTIVE_DATE}
          </p>
        </header>

        <article className="space-y-8 text-base leading-relaxed text-brand-deep/80 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-brand-deep [&_h2]:mt-12 [&_h2]:mb-3 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-brand-deep [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-gold [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-gold-hover [&_strong]:text-brand-deep [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_p]:my-3">
          <section>
            <p>
              Lateef Properties (&ldquo;Lateef Properties&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo; or &ldquo;our&rdquo;) is a real estate marketing agency
              based in Karachi, Pakistan. This Privacy Policy explains how we collect,
              use, share, and protect personal information when you visit our website
              <strong>lateefproperties.com</strong> (the &ldquo;Site&rdquo;), submit an enquiry, or
              interact with our marketing campaigns on Meta (Facebook, Instagram,
              WhatsApp) and Google.
            </p>
            <p>
              By using the Site or submitting an enquiry, you confirm you have read
              and understood this Policy.
            </p>
          </section>

          <section>
            <h2>1. Who We Are (Data Controller)</h2>
            <p>
              Lateef Properties is the data controller responsible for personal
              information collected through this Site.
            </p>
            <ul>
              <li>
                <strong>Registered Address:</strong> Ground Floor Office, Four Seasons
                Apartment, Block 16, Gulshan-e-Iqbal, Karachi, Pakistan.
              </li>
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:info.lateefproperties@gmail.com">
                  info.lateefproperties@gmail.com
                </a>
              </li>
              <li>
                <strong>Phone / WhatsApp:</strong>{' '}
                <a href="tel:+923363528333">+92-3363-LATEEF (+92 336 3528333)</a>
              </li>
            </ul>
          </section>

          <section>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Information You Provide</h3>
            <p>
              When you submit any enquiry form on the Site (project enquiry, listing
              enquiry, consultation request, zero-results lead capture), we collect:
            </p>
            <ul>
              <li>Full name</li>
              <li>Phone number (with country code)</li>
              <li>Email address (optional)</li>
              <li>The project, listing, or property type you enquired about</li>
              <li>Budget range, location preference, or other filter criteria you provided</li>
              <li>Any free-text notes you added to the form</li>
              <li>Timestamp and source page of the submission</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <p>
              When you visit the Site, we and our service providers automatically
              receive:
            </p>
            <ul>
              <li>IP address and approximate location (country, city)</li>
              <li>Browser type, operating system, and device type</li>
              <li>Pages viewed, time spent, navigation paths</li>
              <li>Referring URL (including ad-campaign identifiers)</li>
              <li>Cookies and similar tracking technologies (see Section 5)</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use personal information for the following purposes:</p>
            <ul>
              <li>
                <strong>Responding to your enquiry</strong> — a senior advisor will
                contact you within 24 hours by phone, WhatsApp, or email to discuss
                the property, send details, or schedule a viewing.
              </li>
              <li>
                <strong>Lead management and customer relationship management (CRM)
                </strong>
                — we route enquiries to our CRM (Privyr) so the right advisor follows
                up.
              </li>
              <li>
                <strong>Marketing measurement</strong> — we measure the performance of
                our advertising on Meta and Google so we can improve our campaigns.
              </li>
              <li>
                <strong>Website improvement</strong> — we analyse aggregated traffic
                patterns to improve content, design, and load performance.
              </li>
              <li>
                <strong>Legal and regulatory compliance</strong> — to meet obligations
                under applicable Pakistani law and, where applicable, UAE law.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal information to third
              parties.
            </p>
          </section>

          <section>
            <h2>4. Legal Basis for Processing</h2>
            <p>
              Depending on the activity, our legal bases for processing your personal
              information are:
            </p>
            <ul>
              <li>
                <strong>Consent</strong> — when you submit a form, you consent to be
                contacted about your enquiry.
              </li>
              <li>
                <strong>Legitimate interests</strong> — operating a sustainable
                business and measuring marketing effectiveness.
              </li>
              <li>
                <strong>Compliance with a legal obligation</strong> — where required
                by applicable law.
              </li>
            </ul>
            <p>
              For visitors located in the United Arab Emirates, processing is
              additionally governed by UAE Federal Decree-Law No. 45 of 2021 on
              Personal Data Protection (PDPL).
            </p>
          </section>

          <section>
            <h2>5. Cookies and Tracking Technologies</h2>
            <p>The Site uses the following categories of cookies and trackers:</p>

            <h3>5.1 Strictly Necessary</h3>
            <p>
              Essential cookies that enable the Site to function (e.g. session, page
              splash dismissal). These cannot be disabled.
            </p>

            <h3>5.2 Marketing & Conversion Tracking</h3>
            <p>
              We use third-party advertising pixels to measure the effectiveness of
              our marketing:
            </p>
            <ul>
              <li>
                <strong>Meta Pixel</strong> (from Meta Platforms, Inc.) — fires on
                form submission to attribute leads to Meta ad campaigns. Meta&rsquo;s
                privacy practices are described at{' '}
                <a
                  href="https://www.facebook.com/privacy/policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  facebook.com/privacy/policy
                </a>
                .
              </li>
              <li>
                <strong>Google Ads conversion tracking</strong> (from Google LLC) —
                fires on form submission to attribute leads to Google ad campaigns.
                Google&rsquo;s privacy practices are described at{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  policies.google.com/privacy
                </a>
                .
              </li>
            </ul>

            <p>
              You can opt out of advertising tracking through your browser settings,
              your Meta Ad Preferences (
              <a
                href="https://www.facebook.com/settings?tab=ads"
                target="_blank"
                rel="noopener noreferrer"
              >
                facebook.com/settings?tab=ads
              </a>
              ), and your Google Ad Settings (
              <a
                href="https://adssettings.google.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                adssettings.google.com
              </a>
              ).
            </p>
          </section>

          <section>
            <h2>6. How We Share Your Information</h2>
            <p>
              We share personal information only with the service providers and
              partners listed below, and only to the extent necessary for the purposes
              described above:
            </p>
            <ul>
              <li>
                <strong>Privyr</strong> — our CRM, which receives lead submissions for
                advisor follow-up.
              </li>
              <li>
                <strong>Railway, Inc.</strong> — our cloud hosting and database
                provider.
              </li>
              <li>
                <strong>Meta Platforms, Inc.</strong> — for ad-conversion attribution
                via the Meta Pixel.
              </li>
              <li>
                <strong>Google LLC</strong> — for ad-conversion attribution via Google
                Ads tags.
              </li>
              <li>
                <strong>Property developers and partner agencies</strong> — only where
                you have specifically enquired about a particular project, and only
                the information needed to facilitate your enquiry.
              </li>
              <li>
                <strong>Legal and regulatory authorities</strong> — where required by
                applicable Pakistani or UAE law, a court order, or a legitimate legal
                process.
              </li>
            </ul>
          </section>

          <section>
            <h2>7. International Transfers</h2>
            <p>
              Some of our service providers (Meta, Google, Railway, Privyr) operate
              servers outside Pakistan and the UAE, including in the United States,
              the European Union, and Singapore. Where personal information is
              transferred internationally, we rely on the service providers&rsquo;
              contractual safeguards and applicable cross-border transfer mechanisms.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>
              Subject to applicable law (including UAE PDPL for residents of the UAE),
              you have the following rights regarding your personal information:
            </p>
            <ul>
              <li>
                <strong>Access</strong> — request a copy of the personal information
                we hold about you.
              </li>
              <li>
                <strong>Correction</strong> — ask us to correct inaccurate or
                incomplete information.
              </li>
              <li>
                <strong>Deletion</strong> — ask us to delete your personal information
                where there is no compelling reason for us to keep it.
              </li>
              <li>
                <strong>Withdraw consent</strong> — withdraw your consent at any time
                where consent is the basis for processing.
              </li>
              <li>
                <strong>Object to processing</strong> — object to processing based on
                legitimate interests (including direct marketing).
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:info.lateefproperties@gmail.com">
                info.lateefproperties@gmail.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2>9. Data Retention</h2>
            <p>
              We retain personal information only as long as necessary for the
              purposes for which it was collected:
            </p>
            <ul>
              <li>
                <strong>Lead enquiries</strong> — 24 months from the last interaction,
                after which records are anonymised or deleted.
              </li>
              <li>
                <strong>Marketing analytics</strong> — aggregated and de-identified
                indefinitely.
              </li>
              <li>
                <strong>Tax / regulatory records</strong> — for the minimum period
                required by Pakistani tax and corporate law.
              </li>
            </ul>
          </section>

          <section>
            <h2>10. Security</h2>
            <p>
              We take reasonable technical and organisational measures to protect
              personal information, including encrypted transport (HTTPS), access
              control on our admin systems, and database backups. No transmission over
              the internet is 100% secure; you submit personal information at your own
              risk, though we work to minimise that risk.
            </p>
          </section>

          <section>
            <h2>11. Children</h2>
            <p>
              The Site is not directed at individuals under 18 years of age. We do not
              knowingly collect personal information from anyone under 18. If you
              believe a minor has submitted personal information, contact us and we
              will delete it.
            </p>
          </section>

          <section>
            <h2>12. Third-Party Links</h2>
            <p>
              The Site may link to third-party websites (developer brochures, parent
              company sites, partner agencies). We are not responsible for the privacy
              practices of those sites; please review their privacy policies
              separately.
            </p>
          </section>

          <section>
            <h2>13. Changes to This Policy</h2>
            <p>
              We may update this Policy from time to time. Material changes will be
              announced on this page with a revised &ldquo;Effective&rdquo; date at
              the top. Continued use of the Site after a change constitutes
              acceptance.
            </p>
          </section>

          <section>
            <h2>14. Contact Us</h2>
            <p>
              For any privacy-related questions or to exercise your rights, contact:
            </p>
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
              <Link href="/terms" className="text-gold underline underline-offset-4">
                Terms of Use
              </Link>
              .
            </p>
          </section>
        </article>
      </div>
    </main>
  )
}
