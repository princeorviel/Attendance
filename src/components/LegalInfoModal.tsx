import React, { useEffect } from 'react';
import { BookOpen, FileText, Mail, ShieldCheck, X } from 'lucide-react';

export type LegalTab = 'about' | 'privacy' | 'terms' | 'contact';

interface LegalInfoModalProps {
  activeTab: LegalTab | null;
  onChangeTab: (tab: LegalTab) => void;
  onClose: () => void;
}

const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ||
  'princeorviel@gmail.com';

const TABS: { id: LegalTab; label: string; icon: React.ReactNode }[] = [
  { id: 'about', label: 'ऐप के बारे में', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: 'privacy', label: 'प्राइवेसी पॉलिसी', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'terms', label: 'नियम व शर्तें', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'contact', label: 'संपर्क', icon: <Mail className="h-3.5 w-3.5" /> },
];

export const LegalInfoModal: React.FC<LegalInfoModalProps> = ({
  activeTab,
  onChangeTab,
  onClose,
}) => {
  useEffect(() => {
    if (!activeTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, onClose]);

  if (!activeTab) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ऐप की जानकारी व नीतियाँ"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Attendance — हाज़िरी व सैलरी हिसाब
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              उपयोग गाइड, प्राइवेसी पॉलिसी, नियम व संपर्क जानकारी
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="बंद करें"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Interactive Tab Selector */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeTab(tab.id)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {activeTab === 'about' && (
            <>
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Attendance ऐप क्या है?
                </h3>
                <p>
                  <strong>Attendance — हाज़िरी व सैलरी हिसाब</strong> दुकानदारों, छोटे व्यापारियों,
                  ऑफ़िस मैनेजरों और स्टाफ़ के लिए बनाया गया एक सरल, तेज़ और सुरक्षित डिजिटल
                  हाज़िरी रजिस्टर व सैलरी कैलकुलेटर है। यह हिंदी और अंग्रेज़ी दोनों भाषाओं के
                  उपयोगकर्ताओं के लिए आसान बनाया गया है और इंटरनेट न होने पर भी ऑफ़लाइन काम करता है।
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  मुख्य सुविधाएँ (Key Features)
                </h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>दैनिक हाज़िरी कैलेंडर:</strong> एक टैप में Present, Absent, Leave,
                    Half Leave और छुट्टी (Holiday) दर्ज करें।
                  </li>
                  <li>
                    <strong>ऑटोमैटिक सैलरी व हिसाब कैलकुलेटर:</strong> महीने के दिनों के अनुसार
                    प्रति-दिन सैलरी, एडवांस (Advance), भुगतान (Payment) और पिछले महीने का
                    कैरी-फ़ॉरवर्ड बैलेंस अपने-आप जुड़ता है।
                  </li>
                  <li>
                    <strong>मल्टी-ब्रांच Shop और टीम मैनेजमेंट:</strong> Google लॉगिन से क्लाउड
                    सिंक चालू करें, एक से ज़्यादा Shops/Branches मैनेज करें और Manager को सीमित
                    अधिकार दें।
                  </li>
                  <li>
                    <strong>Staff Self-Service:</strong> स्टाफ़ अपने फ़ोन से GPS लोकेशन व सेल्फ़ी के
                    साथ Punch-In/Out और छुट्टी का अनुरोध भेज सकता है।
                  </li>
                  <li>
                    <strong>PDF / प्रिंट और बैकअप:</strong> किसी भी महीने की सैलरी पर्ची और
                    लेजर PDF या WhatsApp पर शेयर करें और एन्क्रिप्टेड बैकअप सुरक्षित रखें।
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  सैलरी की गणना कैसे होती है?
                </h3>
                <p>
                  प्रत्येक दिन की दर (Per-day rate) महीने की कुल सैलरी को उस महीने के कुल दिनों
                  से भाग देकर निकाली जाती है। <strong>Present</strong> और <strong>छुट्टी</strong> पर
                  पूरा दिन, <strong>Half Leave</strong> पर आधा दिन (0.5), तथा <strong>Absent / Leave</strong>{' '}
                  पर शून्य दिन गिने जाते हैं। इसके बाद पिछले महीने का बकाया जोड़कर और इस महीने का
                  एडवांस/पेमेंट घटाकर शुद्ध देय राशि (Net Payable) दिखाई जाती है।
                </p>
              </section>
            </>
          )}

          {activeTab === 'privacy' && (
            <>
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Privacy Policy (गोपनीयता नीति)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Last Updated: November 2026
                </p>
                <p>
                  आपकी और आपके स्टाफ़ के डेटा की सुरक्षा हमारी सर्वोच्च प्राथमिकता है। यह नीति
                  बताती है कि <strong>Attendance — हाज़िरी व सैलरी हिसाब</strong> कौन सा डेटा
                  सहेजता है और उसका उपयोग कैसे होता है।
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  1. लोकल और क्लाउड डेटा संग्रहण
                </h4>
                <p>
                  ऑफ़लाइन मोड में आपकी हाज़िरी, सैलरी और एडवांस का सारा हिसाब केवल आपके डिवाइस के
                  ब्राउज़र स्टोरेज (Local Storage) में सुरक्षित रहता है। यदि आप स्वेच्छा से{' '}
                  <strong>Google Login (Cloud Shop Sync)</strong> चालू करते हैं, तो आपका नाम, ईमेल
                  और Shop डेटा Google Firebase (Authentication व Firestore) पर एन्क्रिप्टेड कनेक्शन
                  के साथ सहेजा जाता है।
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  2. मल्टी-शॉपकीपर प्राइवेसी (Strict Isolation)
                </h4>
                <p>
                  प्रत्येक Shopkeeper की Shop, स्टाफ़ सूची, हाज़िरी और सैलरी हिसाब पूरी तरह अलग
                  रहते हैं। किसी भी अन्य Shopkeeper या बाहरी व्यक्ति को आपकी Shop या स्टाफ़ का डेटा
                  दिखाई नहीं देता। एक Shop के भीतर भी प्रत्येक Staff सदस्य को केवल अपना निजी हिसाब
                  देखने की अनुमति होती है।
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  3. कैमरा और लोकेशन (GPS) अनुमतियाँ
                </h4>
                <p>
                  कैमरा और GPS लोकेशन का उपयोग केवल तभी किया जाता है जब स्टाफ़ स्वयं सेल्फ़ी या
                  लोकेशन के साथ Punch-In/Out अनुरोध भेजता है या प्रोफ़ाइल फ़ोटो अपलोड करता है।
                  बैकग्राउंड में कोई लोकेशन ट्रैक नहीं की जाती।
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  4. विज्ञापन (Google AdSense) और कुकीज़
                </h4>
                <p>
                  इस वेबसाइट को सभी उपयोगकर्ताओं के लिए मुफ़्त रखने हेतु हम{' '}
                  <strong>Google AdSense</strong> या तृतीय-पक्ष विज्ञापन नेटवर्क का उपयोग कर सकते हैं।
                  Google जैसे तृतीय-पक्ष विक्रेता आपकी इस या अन्य वेबसाइटों की विज़िट के आधार पर
                  उपयोगी विज्ञापन दिखाने के लिए कुकीज़ (Cookies) का उपयोग करते हैं। आप किसी भी समय{' '}
                  <a
                    href="https://adssettings.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400"
                  >
                    Google Ads Settings
                  </a>{' '}
                  पर जाकर पर्सनलाइज़्ड विज्ञापन बंद कर सकते हैं।
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  5. डेटा डिलीट करने का अधिकार
                </h4>
                <p>
                  आप किसी भी समय ऐप के अंदर <strong>Shop व टीम → Danger Zone</strong> में जाकर अपनी
                  किसी भी Shop या अपनी पूरी Shopkeeper ID और उससे जुड़ा सारा क्लाउड डेटा स्थायी रूप
                  से डिलीट कर सकते हैं।
                </p>
              </section>
            </>
          )}

          {activeTab === 'terms' && (
            <>
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Terms of Use (उपयोग की शर्तें)
                </h3>
                <p>
                  इस ऐप या वेबसाइट का उपयोग करके आप नीचे दी गई शर्तों से सहमत होते हैं:
                </p>
              </section>

              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>सटीकता व सत्यापन:</strong> यह ऐप हाज़िरी और सैलरी गणना में सहायता के
                  लिए बनाया गया है। अंतिम सैलरी भुगतान से पहले अपने रिकॉर्ड और गणना की जाँच करना
                  Shop Owner / उपयोगकर्ता की ज़िम्मेदारी है।
                </li>
                <li>
                  <strong>बैकअप की ज़िम्मेदारी:</strong> लोकल (ऑफ़लाइन) मोड में ब्राउज़र डेटा या
                  फ़ोन रीसेट होने पर लोकल रिकॉर्ड मिट सकते हैं। नियमित रूप से Backup सेक्शन से बैकअप
                  फ़ाइल सेव करने या Cloud Shop Sync चालू करने की सलाह दी जाती है।
                </li>
                <li>
                  <strong>उचित उपयोग:</strong> इस सेवा का उपयोग किसी अवैध गतिविधि, अनधिकृत डेटा
                  एक्सेस या सिस्टम को नुकसान पहुँचाने के लिए नहीं किया जा सकता।
                </li>
                <li>
                  <strong>सेवा में बदलाव:</strong> हम समय-समय पर ऐप के फ़ीचर्स, डिज़ाइन और नीतियों
                  में सुधार कर सकते हैं।
                </li>
              </ul>
            </>
          )}

          {activeTab === 'contact' && (
            <>
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  संपर्क करें (Contact & Support)
                </h3>
                <p>
                  यदि आपको ऐप के उपयोग, डेटा प्राइवेसी, अकाउंट सहायता या किसी सुझाव के संबंध में हमसे
                  संपर्क करना हो, तो आप नीचे दिए गए ईमेल पर संदेश भेज सकते हैं:
                </p>
              </section>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Support Email
                </div>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <Mail className="h-4 w-4" />
                  <span>{CONTACT_EMAIL}</span>
                </a>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  सामान्य उत्तर समय: 24–48 कार्य घंटे।
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
