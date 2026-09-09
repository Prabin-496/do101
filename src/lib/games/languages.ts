import { romajiToKana } from "@/lib/japanese/kana";

/**
 * Languages for the typing test.
 *
 * Most of these need the matching keyboard layout installed, and each one says
 * so rather than letting someone stare at a script their keyboard cannot
 * produce. Japanese is the exception: you type romaji and the page converts it
 * to kana as you go, using the same exact conversion table as the romaji tool,
 * so it works on any keyboard in the world.
 */

export type TypingScript = "latin" | "kana" | "cyrillic" | "devanagari" | "arabic";

export interface TypingLanguage {
  id: string;
  /** English name. */
  name: string;
  /** The name in the language itself. */
  native: string;
  flag: string;
  script: TypingScript;
  direction: "ltr" | "rtl";
  /** How keystrokes become the target script. */
  input: "direct" | "romaji-to-kana";
  /** Speed unit that makes sense for the script. */
  metric: "wpm" | "cpm";
  /** What the reader needs before this will work. */
  requirement?: string;
  words: string[];
  sentences: string[];
}

const EN: TypingLanguage = {
  id: "en", name: "English", native: "English", flag: "🇬🇧",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  words: "time people way year work day thing world life hand part child eye woman place case point government company number group problem fact water month book light money story result study idea music market food level paper state door school power game line end member law car city name team minute kind head house service friend father hour art war history party reason research girl guy moment air teacher force education foot boy age policy process sense nation plan college interest death course someone experience behind reach local sure face cut already during field huge happy hope floor rather enough almost travel system program question without again great little right think around every large small under while never before between should because through different following important children example together possible actually business building national personal standard training language computer internet software keyboard practice attention progress quickly simple common natural modern future record design effort choose strong bright forward balance journey evening morning weather picture science perfect present support control develop imagine measure organise perform protect realise".split(" "),
  sentences: [
    "The quick brown fox jumps over the lazy dog while the rest of the field watches in silence.",
    "Practice makes progress, and progress is what turns a slow start into a steady rhythm.",
    "Good typing is less about raw speed and more about keeping a clean, even pace under pressure.",
    "Focus on accuracy first; speed arrives quietly once your fingers stop guessing.",
    "Read one word ahead of the one you are typing and the sentence starts to flow.",
  ],
};

/**
 * Japanese, typed as romaji and converted to kana as you go.
 *
 * The target is written in kana only, because kanji cannot be typed without an
 * IME — you would type the reading and press space to convert, which is a
 * different skill from typing speed.
 */
const JA: TypingLanguage = {
  id: "ja", name: "Japanese", native: "日本語", flag: "🇯🇵",
  script: "kana", direction: "ltr", input: "romaji-to-kana", metric: "cpm",
  requirement: "Type romaji on your normal keyboard — it becomes kana as you go. No IME needed.",
  words: "わたし あなた ひと ともだち せんせい がくせい かぞく こども おとな なまえ にほん とうきょう くに まち みち えき でんしゃ くるま じてんしゃ ひこうき みず おちゃ ごはん たべもの のみもの やさい くだもの さかな にく たまご あさ ひる よる きょう あした きのう じかん ふん とけい がっこう だいがく かいしゃ しごと べんきょう しゅくだい ほん しんぶん てがみ しゃしん おんがく えいが てんき あめ ゆき かぜ はな き いぬ ねこ とり うみ やま かわ そら いえ へや まど ドア つくえ いす でんわ おかね みせ びょういん ぎんこう こうえん ちず かばん くつ ふく ぼうし めがね あたま て あし め みみ くち こころ ちから こえ たのしい うれしい おいしい おおきい ちいさい あたらしい ふるい たかい やすい はやい おそい ちかい とおい あかるい しずか きれい げんき べんり たいせつ だいじょうぶ ありがとう すみません おはよう こんにちは さようなら はじめまして いきます きます たべます のみます みます ききます はなします よみます かきます かいます わかります".split(" "),
  sentences: [
    "きょうはいいてんきですね。",
    "わたしはまいにちにほんごをべんきょうしています。",
    "えきまであるいてじゅっぷんぐらいかかります。",
    "あたらしいことをまなぶのはたのしいです。",
    "ゆっくりでいいのでせいかくにうちましょう。",
  ],
};

const ES: TypingLanguage = {
  id: "es", name: "Spanish", native: "Español", flag: "🇪🇸",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Accented letters need a Spanish keyboard layout or AltGr.",
  words: "tiempo persona año trabajo día cosa mundo vida mano parte niño ojo mujer lugar caso punto gobierno empresa número grupo problema hecho agua mes libro luz dinero historia estudio idea música mercado comida nivel papel estado puerta escuela poder juego línea final miembro ley coche ciudad nombre equipo minuto cabeza casa servicio amigo padre hora arte guerra fiesta razón chica momento aire maestro fuerza educación pie edad proceso sentido nación plan interés muerte curso alguien experiencia detrás alcanzar local seguro cara campo enorme feliz esperanza suelo bastante casi viajar sistema programa pregunta otra vez grande pequeño mientras nunca antes entre porque través diferente siguiente importante ejemplo juntos posible realmente negocio edificio nacional personal estándar idioma ordenador internet programa teclado práctica atención progreso rápido simple común natural moderno futuro registro diseño esfuerzo elegir fuerte brillante adelante equilibrio viaje tarde mañana clima imagen ciencia perfecto presente apoyo control".split(" "),
  sentences: [
    "La práctica constante convierte un comienzo lento en un ritmo firme.",
    "Escribir bien depende más de la precisión que de la velocidad pura.",
    "Cada teclado tiene su propio ritmo y conviene aprender a escucharlo.",
    "Lee una palabra por delante y la frase empezará a fluir sola.",
  ],
};

const FR: TypingLanguage = {
  id: "fr", name: "French", native: "Français", flag: "🇫🇷",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Accented letters need a French (AZERTY) layout or AltGr.",
  words: "temps personne année travail jour chose monde vie main partie enfant œil femme lieu cas point gouvernement entreprise nombre groupe problème fait eau mois livre lumière argent histoire étude idée musique marché nourriture niveau papier état porte école pouvoir jeu ligne fin membre loi voiture ville nom équipe minute tête maison service ami père heure art guerre fête raison fille moment air professeur force éducation pied âge processus sens nation plan intérêt mort cours quelqu'un expérience derrière atteindre local sûr visage champ énorme heureux espoir sol assez presque voyager système programme question encore grand petit pendant jamais avant entre parce travers différent suivant important exemple ensemble possible vraiment affaire bâtiment national personnel standard langue ordinateur clavier pratique attention progrès rapide simple commun naturel moderne avenir registre conception effort choisir fort brillant avant équilibre voyage soir matin météo image science parfait présent soutien contrôle".split(" "),
  sentences: [
    "La pratique régulière transforme un départ lent en un rythme régulier.",
    "Bien taper tient moins à la vitesse brute qu'à la régularité.",
    "Chaque clavier a son rythme et les meilleurs apprennent à l'écouter.",
    "Lisez un mot d'avance et la phrase se met à couler toute seule.",
  ],
};

const DE: TypingLanguage = {
  id: "de", name: "German", native: "Deutsch", flag: "🇩🇪",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Umlauts and ß need a German (QWERTZ) layout.",
  words: "Zeit Mensch Jahr Arbeit Tag Ding Welt Leben Hand Teil Kind Auge Frau Ort Fall Punkt Regierung Firma Zahl Gruppe Problem Tatsache Wasser Monat Buch Licht Geld Geschichte Studie Idee Musik Markt Essen Ebene Papier Staat Tür Schule Macht Spiel Linie Ende Mitglied Gesetz Auto Stadt Name Team Minute Kopf Haus Dienst Freund Vater Stunde Kunst Krieg Partei Grund Mädchen Moment Luft Lehrer Kraft Bildung Fuß Alter Prozess Sinn Nation Plan Interesse Tod Kurs jemand Erfahrung hinter erreichen lokal sicher Gesicht Feld riesig glücklich Hoffnung Boden genug fast reisen System Programm Frage wieder groß klein während niemals zwischen weil durch anders folgend wichtig Beispiel zusammen möglich wirklich Geschäft Gebäude national persönlich Standard Sprache Computer Tastatur Übung Aufmerksamkeit Fortschritt schnell einfach häufig natürlich modern Zukunft Aufzeichnung Entwurf Anstrengung wählen stark hell vorwärts Gleichgewicht Reise Abend Morgen Wetter Bild Wissenschaft perfekt gegenwärtig".split(" "),
  sentences: [
    "Regelmäßiges Üben macht aus einem langsamen Anfang einen gleichmäßigen Rhythmus.",
    "Gutes Tippen hängt weniger von der Geschwindigkeit als von der Genauigkeit ab.",
    "Jede Tastatur hat ihren eigenen Rhythmus, und gute Tipper hören ihn heraus.",
    "Lies ein Wort voraus, dann beginnt der Satz von selbst zu fließen.",
  ],
};

const PT: TypingLanguage = {
  id: "pt", name: "Portuguese", native: "Português", flag: "🇵🇹",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Accented letters need a Portuguese keyboard layout or AltGr.",
  words: "tempo pessoa ano trabalho dia coisa mundo vida mão parte criança olho mulher lugar caso ponto governo empresa número grupo problema facto água mês livro luz dinheiro história estudo ideia música mercado comida nível papel estado porta escola poder jogo linha fim membro lei carro cidade nome equipa minuto cabeça casa serviço amigo pai hora arte guerra festa razão rapariga momento ar professor força educação pé idade processo sentido nação plano interesse morte curso alguém experiência atrás alcançar local seguro rosto campo enorme feliz esperança chão bastante quase viajar sistema programa pergunta novamente grande pequeno enquanto nunca antes entre porque através diferente seguinte importante exemplo juntos possível realmente negócio edifício nacional pessoal padrão língua computador teclado prática atenção progresso rápido simples comum natural moderno futuro registo desenho esforço escolher forte brilhante equilíbrio viagem tarde manhã tempo imagem ciência perfeito presente apoio controlo".split(" "),
  sentences: [
    "A prática constante transforma um começo lento num ritmo firme.",
    "Escrever bem depende mais da precisão do que da velocidade pura.",
    "Cada teclado tem o seu ritmo e vale a pena aprender a ouvi-lo.",
    "Leia uma palavra à frente e a frase começa a fluir sozinha.",
  ],
};

const IT: TypingLanguage = {
  id: "it", name: "Italian", native: "Italiano", flag: "🇮🇹",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Accented letters need an Italian keyboard layout.",
  words: "tempo persona anno lavoro giorno cosa mondo vita mano parte bambino occhio donna luogo caso punto governo azienda numero gruppo problema fatto acqua mese libro luce denaro storia studio idea musica mercato cibo livello carta stato porta scuola potere gioco linea fine membro legge auto città nome squadra minuto testa casa servizio amico padre ora arte guerra festa ragione ragazza momento aria insegnante forza istruzione piede età processo senso nazione piano interesse morte corso qualcuno esperienza dietro raggiungere locale sicuro viso campo enorme felice speranza pavimento abbastanza quasi viaggiare sistema programma domanda ancora grande piccolo mentre mai prima tra perché attraverso diverso seguente importante esempio insieme possibile davvero affare edificio nazionale personale standard lingua computer tastiera pratica attenzione progresso veloce semplice comune naturale moderno futuro registro disegno sforzo scegliere forte luminoso equilibrio viaggio sera mattina meteo immagine scienza perfetto presente".split(" "),
  sentences: [
    "La pratica costante trasforma un inizio lento in un ritmo regolare.",
    "Scrivere bene dipende più dalla precisione che dalla velocità pura.",
    "Ogni tastiera ha il suo ritmo e conviene imparare ad ascoltarlo.",
    "Leggi una parola in anticipo e la frase comincia a scorrere da sola.",
  ],
};

const ID: TypingLanguage = {
  id: "id", name: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩",
  script: "latin", direction: "ltr", input: "direct", metric: "wpm",
  words: "waktu orang tahun kerja hari benda dunia hidup tangan bagian anak mata perempuan tempat kasus titik pemerintah perusahaan nomor kelompok masalah fakta air bulan buku cahaya uang cerita belajar ide musik pasar makanan tingkat kertas negara pintu sekolah kekuatan permainan garis akhir anggota hukum mobil kota nama tim menit kepala rumah layanan teman ayah jam seni perang pesta alasan gadis saat udara guru pendidikan kaki usia proses arti bangsa rencana minat kematian kursus seseorang pengalaman belakang mencapai lokal aman wajah ladang besar bahagia harapan lantai cukup hampir bepergian sistem program pertanyaan lagi kecil sementara pernah sebelum antara karena melalui berbeda berikut penting contoh bersama mungkin sebenarnya bisnis bangunan nasional pribadi standar bahasa komputer papan latihan perhatian kemajuan cepat sederhana umum alami modern masa depan catatan desain usaha memilih kuat cerah keseimbangan perjalanan sore pagi cuaca gambar ilmu sempurna dukungan kendali".split(" "),
  sentences: [
    "Latihan yang teratur mengubah awal yang lambat menjadi irama yang mantap.",
    "Mengetik dengan baik lebih bergantung pada ketepatan daripada kecepatan.",
    "Setiap papan ketik punya iramanya sendiri dan sebaiknya kita mendengarkannya.",
    "Bacalah satu kata di depan maka kalimat akan mengalir dengan sendirinya.",
  ],
};

const RU: TypingLanguage = {
  id: "ru", name: "Russian", native: "Русский", flag: "🇷🇺",
  script: "cyrillic", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Needs a Russian (ЙЦУКЕН) keyboard layout installed.",
  words: "время человек год работа день вещь мир жизнь рука часть ребёнок глаз женщина место случай точка правительство компания число группа проблема факт вода месяц книга свет деньги история изучение идея музыка рынок еда уровень бумага город дверь школа сила игра линия конец член закон машина имя команда минута голова дом услуга друг отец час искусство война партия причина девушка момент воздух учитель образование нога возраст процесс смысл народ план интерес смерть курс кто-то опыт позади достичь местный лицо поле огромный счастливый надежда пол достаточно почти путешествовать система программа вопрос снова большой маленький пока никогда раньше между потому через разный следующий важный пример вместе возможно действительно дело здание язык компьютер клавиатура практика внимание прогресс быстро просто общий природный современный будущее запись усилие выбрать сильный яркий равновесие вечер утро погода наука".split(" "),
  sentences: [
    "Постоянная практика превращает медленное начало в ровный ритм.",
    "Хорошая печать зависит больше от точности, чем от чистой скорости.",
    "У каждой клавиатуры свой ритм, и его стоит научиться слышать.",
    "Читайте на слово вперёд, и предложение потечёт само собой.",
  ],
};

const HI: TypingLanguage = {
  id: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳",
  script: "devanagari", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Needs a Hindi keyboard layout (InScript or phonetic) installed.",
  words: "समय व्यक्ति साल काम दिन चीज़ दुनिया जीवन हाथ भाग बच्चा आँख महिला जगह बात बिंदु सरकार कंपनी संख्या समूह समस्या तथ्य पानी महीना किताब रोशनी पैसा कहानी अध्ययन विचार संगीत बाज़ार खाना स्तर कागज़ राज्य दरवाज़ा स्कूल शक्ति खेल रेखा अंत सदस्य कानून गाड़ी शहर नाम टीम मिनट सिर घर सेवा दोस्त पिता घंटा कला युद्ध कारण लड़की पल हवा शिक्षक बल शिक्षा पैर उम्र प्रक्रिया अर्थ देश योजना रुचि मृत्यु कोई अनुभव पीछे पहुँचना स्थानीय चेहरा खेत विशाल खुश आशा फर्श पर्याप्त लगभग यात्रा प्रणाली कार्यक्रम प्रश्न फिर बड़ा छोटा जबकि कभी पहले बीच क्योंकि अलग अगला महत्वपूर्ण उदाहरण साथ संभव वास्तव व्यवसाय इमारत राष्ट्रीय व्यक्तिगत भाषा कंप्यूटर अभ्यास ध्यान प्रगति तेज़ सरल सामान्य प्राकृतिक आधुनिक भविष्य रिकॉर्ड प्रयास मजबूत उज्ज्वल संतुलन शाम सुबह मौसम विज्ञान".split(" "),
  sentences: [
    "नियमित अभ्यास धीमी शुरुआत को एक स्थिर लय में बदल देता है।",
    "अच्छी टाइपिंग गति से ज़्यादा सटीकता पर निर्भर करती है।",
    "हर कीबोर्ड की अपनी लय होती है और उसे सुनना सीखना चाहिए।",
    "एक शब्द आगे पढ़िए और वाक्य अपने आप बहने लगेगा।",
  ],
};

const NE: TypingLanguage = {
  id: "ne", name: "Nepali", native: "नेपाली", flag: "🇳🇵",
  script: "devanagari", direction: "ltr", input: "direct", metric: "wpm",
  requirement: "Needs a Nepali keyboard layout (Romanised or Traditional) installed.",
  words: "समय मानिस वर्ष काम दिन कुरा संसार जीवन हात भाग बच्चा आँखा महिला ठाउँ घटना बुँदा सरकार कम्पनी संख्या समूह समस्या तथ्य पानी महिना किताब उज्यालो पैसा कथा अध्ययन विचार संगीत बजार खाना तह कागज राज्य ढोका विद्यालय शक्ति खेल रेखा अन्त्य सदस्य कानुन गाडी सहर नाम समूह मिनेट टाउको घर सेवा साथी बुबा घण्टा कला युद्ध कारण केटी क्षण हावा शिक्षक बल शिक्षा खुट्टा उमेर प्रक्रिया अर्थ देश योजना रुचि मृत्यु कोही अनुभव पछाडि पुग्नु स्थानीय अनुहार खेत विशाल खुसी आशा भुइँ पर्याप्त झन्डै यात्रा प्रणाली कार्यक्रम प्रश्न फेरि ठूलो सानो जबकि कहिल्यै पहिले बीच किनभने फरक अर्को महत्त्वपूर्ण उदाहरण सँगै सम्भव साँच्चै व्यवसाय भवन राष्ट्रिय व्यक्तिगत भाषा कम्प्युटर अभ्यास ध्यान प्रगति छिटो सरल सामान्य प्राकृतिक आधुनिक भविष्य अभिलेख प्रयास बलियो उज्ज्वल सन्तुलन बेलुका बिहान मौसम विज्ञान".split(" "),
  sentences: [
    "नियमित अभ्यासले ढिलो सुरुवातलाई स्थिर लयमा बदल्छ।",
    "राम्रो टाइपिङ गतिभन्दा शुद्धतामा बढी निर्भर हुन्छ।",
    "हरेक किबोर्डको आफ्नै लय हुन्छ, त्यो सुन्न सिक्नुपर्छ।",
    "एक शब्द अगाडि पढ्नुहोस्, वाक्य आफैँ बग्न थाल्छ।",
  ],
};

const AR: TypingLanguage = {
  id: "ar", name: "Arabic", native: "العربية", flag: "🇸🇦",
  script: "arabic", direction: "rtl", input: "direct", metric: "wpm",
  requirement: "Needs an Arabic keyboard layout installed. The text runs right to left.",
  words: "وقت شخص سنة عمل يوم شيء عالم حياة يد جزء طفل عين امرأة مكان حالة نقطة حكومة شركة رقم مجموعة مشكلة حقيقة ماء شهر كتاب ضوء مال قصة دراسة فكرة موسيقى سوق طعام مستوى ورق دولة باب مدرسة قوة لعبة خط نهاية عضو قانون سيارة مدينة اسم فريق دقيقة رأس بيت خدمة صديق أب ساعة فن حرب حزب سبب فتاة لحظة هواء معلم تعليم قدم عمر عملية معنى أمة خطة اهتمام موت دورة أحد خبرة خلف يصل محلي وجه حقل ضخم سعيد أمل أرض كافي تقريبا سفر نظام برنامج سؤال مرة كبير صغير بينما أبدا قبل بين لأن خلال مختلف التالي مهم مثال معا ممكن حقا عمل مبنى وطني شخصي لغة حاسوب لوحة ممارسة انتباه تقدم سريع بسيط شائع طبيعي حديث مستقبل سجل جهد اختيار قوي مشرق توازن رحلة مساء صباح طقس علم".split(" "),
  sentences: [
    "الممارسة المنتظمة تحول البداية البطيئة إلى إيقاع ثابت.",
    "الكتابة الجيدة تعتمد على الدقة أكثر من السرعة المجردة.",
    "لكل لوحة مفاتيح إيقاعها الخاص ويجدر بنا أن نتعلم سماعه.",
    "اقرأ كلمة واحدة إلى الأمام وستبدأ الجملة في التدفق وحدها.",
  ],
};

export const TYPING_LANGUAGES: TypingLanguage[] = [EN, JA, ES, FR, DE, PT, IT, ID, RU, HI, NE, AR];

export const LANGUAGE_MAP = new Map(TYPING_LANGUAGES.map((l) => [l.id, l]));

export function getLanguage(id: string): TypingLanguage {
  return LANGUAGE_MAP.get(id) ?? EN;
}

export interface ConvertedInput {
  /** What to compare against the target. */
  compare: string;
  /** What to show the typist, including a syllable still being formed. */
  display: string;
  /** Romaji not yet forming a complete kana, shown as pending rather than wrong. */
  pending: string;
}

/**
 * Turns raw keystrokes into the target script.
 *
 * For Japanese this is the interesting case: a half-typed syllable such as "k"
 * is not a mistake, it is a syllable in progress, so it is held back from the
 * comparison instead of counting against accuracy.
 */
export function convertInput(typed: string, language: TypingLanguage): ConvertedInput {
  if (language.input !== "romaji-to-kana") {
    return { compare: typed, display: typed, pending: "" };
  }
  const kana = romajiToKana(typed);
  const pending = /[a-z]+$/i.exec(kana)?.[0] ?? "";
  return {
    compare: pending ? kana.slice(0, kana.length - pending.length) : kana,
    display: kana,
    pending,
  };
}
