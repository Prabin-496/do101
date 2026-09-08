import { DEFAULT_LOCALE } from "./locales";

/**
 * Interface strings.
 *
 * Deliberately a small, stable set — navigation, actions and the homepage
 * hero — so every language can be checked rather than bulk-generated. Any key
 * a translation is missing falls back to English rather than showing a blank.
 */
export interface Messages {
  "nav.tools": string;
  "nav.pdf": string;
  "nav.news": string;
  "nav.games": string;
  "nav.calculators": string;
  "nav.ai": string;
  "nav.about": string;
  "nav.search": string;
  "nav.categories": string;
  "nav.jumpIn": string;
  "nav.seeAll": string;
  "nav.menu": string;
  "nav.close": string;
  "hero.tagline": string;
  "hero.subtitle": string;
  "hero.prompt": string;
  "hero.browsePdf": string;
  "hero.browseAll": string;
  "hero.askAi": string;
  "hero.noUpload": string;
  "hero.noAccount": string;
  "hero.noLimits": string;
  "hero.freeTools": string;
  "common.free": string;
  "common.copy": string;
  "common.copied": string;
  "common.download": string;
  "common.clear": string;
  "common.reset": string;
  "common.loading": string;
  "footer.tagline": string;
  "footer.rights": string;
  "lang.label": string;
  "lang.choose": string;
  "lang.uiOnly": string;
  "lang.detected": string;
}

const en: Messages = {
  "nav.tools": "Tools",
  "nav.pdf": "PDF",
  "nav.news": "News",
  "nav.games": "Games",
  "nav.calculators": "Calculators",
  "nav.ai": "AI",
  "nav.about": "About",
  "nav.search": "Search tools",
  "nav.categories": "Categories",
  "nav.jumpIn": "Jump straight in",
  "nav.seeAll": "See every tool",
  "nav.menu": "Open menu",
  "nav.close": "Close menu",
  "hero.tagline": "Do more. Simply.",
  "hero.subtitle":
    "Merge a PDF, compress a photo, convert a file, format some JSON, settle a calculation — free, with no sign-up. Almost everything runs inside your browser, so your files are never uploaded.",
  "hero.prompt": "What do you want to do?",
  "hero.browsePdf": "PDF tools",
  "hero.browseAll": "Browse all",
  "hero.askAi": "Ask DO101 AI",
  "hero.noUpload": "No upload — files stay on your device",
  "hero.noAccount": "No account, no watermark",
  "hero.noLimits": "No file limits or credits",
  "hero.freeTools": "free tools · no sign-up · no upload",
  "common.free": "Free",
  "common.copy": "Copy",
  "common.copied": "Copied!",
  "common.download": "Download",
  "common.clear": "Clear",
  "common.reset": "Reset",
  "common.loading": "Loading…",
  "footer.tagline": "Do more. Simply.",
  "footer.rights": "All rights reserved.",
  "lang.label": "Language",
  "lang.choose": "Choose a language",
  "lang.uiOnly":
    "The interface is translated. Tool pages are still written in English while they are translated properly.",
  "lang.detected": "Detected from your browser",
};

const ja: Messages = {
  "nav.tools": "ツール",
  "nav.pdf": "PDF",
  "nav.news": "ニュース",
  "nav.games": "ゲーム",
  "nav.calculators": "計算ツール",
  "nav.ai": "AI",
  "nav.about": "DO101について",
  "nav.search": "ツールを検索",
  "nav.categories": "カテゴリー",
  "nav.jumpIn": "よく使うツール",
  "nav.seeAll": "すべてのツールを見る",
  "nav.menu": "メニューを開く",
  "nav.close": "メニューを閉じる",
  "hero.tagline": "もっと簡単に。",
  "hero.subtitle":
    "PDFの結合、写真の圧縮、ファイル変換、JSONの整形、計算まで — 登録不要、すべて無料。ほとんどの処理はブラウザ内で完結するので、ファイルがアップロードされることはありません。",
  "hero.prompt": "何をしますか？",
  "hero.browsePdf": "PDFツール",
  "hero.browseAll": "すべて見る",
  "hero.askAi": "DO101 AIに聞く",
  "hero.noUpload": "アップロードなし — ファイルは端末内に留まります",
  "hero.noAccount": "アカウント不要・透かしなし",
  "hero.noLimits": "ファイル制限・クレジットなし",
  "hero.freeTools": "個の無料ツール · 登録不要 · アップロードなし",
  "common.free": "無料",
  "common.copy": "コピー",
  "common.copied": "コピーしました",
  "common.download": "ダウンロード",
  "common.clear": "クリア",
  "common.reset": "リセット",
  "common.loading": "読み込み中…",
  "footer.tagline": "もっと簡単に。",
  "footer.rights": "無断転載を禁じます。",
  "lang.label": "言語",
  "lang.choose": "言語を選択",
  "lang.uiOnly":
    "インターフェースは翻訳済みです。各ツールページの解説文は、正式な翻訳が完了するまで英語のままです。",
  "lang.detected": "ブラウザの設定から判定",
};

const es: Messages = {
  "nav.tools": "Herramientas",
  "nav.pdf": "PDF",
  "nav.news": "Noticias",
  "nav.games": "Juegos",
  "nav.calculators": "Calculadoras",
  "nav.ai": "IA",
  "nav.about": "Acerca de",
  "nav.search": "Buscar herramientas",
  "nav.categories": "Categorías",
  "nav.jumpIn": "Empieza aquí",
  "nav.seeAll": "Ver todas las herramientas",
  "nav.menu": "Abrir menú",
  "nav.close": "Cerrar menú",
  "hero.tagline": "Haz más. Fácil.",
  "hero.subtitle":
    "Une un PDF, comprime una foto, convierte un archivo, formatea JSON o resuelve un cálculo: gratis y sin registro. Casi todo funciona dentro de tu navegador, así que tus archivos nunca se suben.",
  "hero.prompt": "¿Qué quieres hacer?",
  "hero.browsePdf": "Herramientas PDF",
  "hero.browseAll": "Ver todas",
  "hero.askAi": "Pregunta a DO101 AI",
  "hero.noUpload": "Sin subidas: los archivos se quedan en tu dispositivo",
  "hero.noAccount": "Sin cuenta ni marca de agua",
  "hero.noLimits": "Sin límites de archivos ni créditos",
  "hero.freeTools": "herramientas gratuitas · sin registro · sin subidas",
  "common.free": "Gratis",
  "common.copy": "Copiar",
  "common.copied": "¡Copiado!",
  "common.download": "Descargar",
  "common.clear": "Limpiar",
  "common.reset": "Restablecer",
  "common.loading": "Cargando…",
  "footer.tagline": "Haz más. Fácil.",
  "footer.rights": "Todos los derechos reservados.",
  "lang.label": "Idioma",
  "lang.choose": "Elige un idioma",
  "lang.uiOnly":
    "La interfaz está traducida. Las páginas de herramientas siguen en inglés mientras se traducen correctamente.",
  "lang.detected": "Detectado por tu navegador",
};

const fr: Messages = {
  "nav.tools": "Outils",
  "nav.pdf": "PDF",
  "nav.news": "Actualités",
  "nav.games": "Jeux",
  "nav.calculators": "Calculatrices",
  "nav.ai": "IA",
  "nav.about": "À propos",
  "nav.search": "Rechercher des outils",
  "nav.categories": "Catégories",
  "nav.jumpIn": "Accès direct",
  "nav.seeAll": "Voir tous les outils",
  "nav.menu": "Ouvrir le menu",
  "nav.close": "Fermer le menu",
  "hero.tagline": "Faites plus. Simplement.",
  "hero.subtitle":
    "Fusionnez un PDF, compressez une photo, convertissez un fichier, formatez du JSON ou faites un calcul — gratuitement et sans inscription. Presque tout s’exécute dans votre navigateur : vos fichiers ne sont jamais envoyés.",
  "hero.prompt": "Que voulez-vous faire ?",
  "hero.browsePdf": "Outils PDF",
  "hero.browseAll": "Tout voir",
  "hero.askAi": "Demander à DO101 AI",
  "hero.noUpload": "Aucun envoi — vos fichiers restent sur votre appareil",
  "hero.noAccount": "Sans compte ni filigrane",
  "hero.noLimits": "Sans limite de fichiers ni crédits",
  "hero.freeTools": "outils gratuits · sans inscription · sans envoi",
  "common.free": "Gratuit",
  "common.copy": "Copier",
  "common.copied": "Copié !",
  "common.download": "Télécharger",
  "common.clear": "Effacer",
  "common.reset": "Réinitialiser",
  "common.loading": "Chargement…",
  "footer.tagline": "Faites plus. Simplement.",
  "footer.rights": "Tous droits réservés.",
  "lang.label": "Langue",
  "lang.choose": "Choisir une langue",
  "lang.uiOnly":
    "L’interface est traduite. Les pages d’outils restent en anglais le temps d’être traduites correctement.",
  "lang.detected": "Détecté depuis votre navigateur",
};

const de: Messages = {
  "nav.tools": "Werkzeuge",
  "nav.pdf": "PDF",
  "nav.news": "Nachrichten",
  "nav.games": "Spiele",
  "nav.calculators": "Rechner",
  "nav.ai": "KI",
  "nav.about": "Über uns",
  "nav.search": "Werkzeuge suchen",
  "nav.categories": "Kategorien",
  "nav.jumpIn": "Direkt loslegen",
  "nav.seeAll": "Alle Werkzeuge ansehen",
  "nav.menu": "Menü öffnen",
  "nav.close": "Menü schließen",
  "hero.tagline": "Mehr schaffen. Einfach.",
  "hero.subtitle":
    "PDFs zusammenführen, Fotos verkleinern, Dateien umwandeln, JSON formatieren oder rechnen — kostenlos und ohne Anmeldung. Fast alles läuft im Browser, deine Dateien werden nie hochgeladen.",
  "hero.prompt": "Was möchtest du tun?",
  "hero.browsePdf": "PDF-Werkzeuge",
  "hero.browseAll": "Alle ansehen",
  "hero.askAi": "DO101 AI fragen",
  "hero.noUpload": "Kein Upload — Dateien bleiben auf deinem Gerät",
  "hero.noAccount": "Kein Konto, kein Wasserzeichen",
  "hero.noLimits": "Keine Dateilimits, keine Credits",
  "hero.freeTools": "kostenlose Werkzeuge · ohne Anmeldung · ohne Upload",
  "common.free": "Kostenlos",
  "common.copy": "Kopieren",
  "common.copied": "Kopiert!",
  "common.download": "Herunterladen",
  "common.clear": "Leeren",
  "common.reset": "Zurücksetzen",
  "common.loading": "Wird geladen…",
  "footer.tagline": "Mehr schaffen. Einfach.",
  "footer.rights": "Alle Rechte vorbehalten.",
  "lang.label": "Sprache",
  "lang.choose": "Sprache wählen",
  "lang.uiOnly":
    "Die Oberfläche ist übersetzt. Die Werkzeugseiten bleiben vorerst auf Englisch, bis sie sauber übersetzt sind.",
  "lang.detected": "Aus deinem Browser erkannt",
};

const pt: Messages = {
  "nav.tools": "Ferramentas",
  "nav.pdf": "PDF",
  "nav.news": "Notícias",
  "nav.games": "Jogos",
  "nav.calculators": "Calculadoras",
  "nav.ai": "IA",
  "nav.about": "Sobre",
  "nav.search": "Buscar ferramentas",
  "nav.categories": "Categorias",
  "nav.jumpIn": "Comece por aqui",
  "nav.seeAll": "Ver todas as ferramentas",
  "nav.menu": "Abrir menu",
  "nav.close": "Fechar menu",
  "hero.tagline": "Faça mais. Simples.",
  "hero.subtitle":
    "Junte PDFs, comprima fotos, converta arquivos, formate JSON ou faça um cálculo — grátis e sem cadastro. Quase tudo roda no seu navegador, então seus arquivos nunca são enviados.",
  "hero.prompt": "O que você quer fazer?",
  "hero.browsePdf": "Ferramentas PDF",
  "hero.browseAll": "Ver todas",
  "hero.askAi": "Pergunte ao DO101 AI",
  "hero.noUpload": "Sem envio — os arquivos ficam no seu dispositivo",
  "hero.noAccount": "Sem conta e sem marca d'água",
  "hero.noLimits": "Sem limites de arquivo ou créditos",
  "hero.freeTools": "ferramentas gratuitas · sem cadastro · sem envio",
  "common.free": "Grátis",
  "common.copy": "Copiar",
  "common.copied": "Copiado!",
  "common.download": "Baixar",
  "common.clear": "Limpar",
  "common.reset": "Redefinir",
  "common.loading": "Carregando…",
  "footer.tagline": "Faça mais. Simples.",
  "footer.rights": "Todos os direitos reservados.",
  "lang.label": "Idioma",
  "lang.choose": "Escolha um idioma",
  "lang.uiOnly":
    "A interface está traduzida. As páginas das ferramentas continuam em inglês até serem traduzidas corretamente.",
  "lang.detected": "Detectado pelo seu navegador",
};

const hi: Messages = {
  "nav.tools": "टूल्स",
  "nav.pdf": "PDF",
  "nav.news": "समाचार",
  "nav.games": "गेम्स",
  "nav.calculators": "कैलकुलेटर",
  "nav.ai": "एआई",
  "nav.about": "परिचय",
  "nav.search": "टूल खोजें",
  "nav.categories": "श्रेणियाँ",
  "nav.jumpIn": "यहाँ से शुरू करें",
  "nav.seeAll": "सभी टूल देखें",
  "nav.menu": "मेन्यू खोलें",
  "nav.close": "मेन्यू बंद करें",
  "hero.tagline": "और करें। आसानी से।",
  "hero.subtitle":
    "PDF जोड़ें, फ़ोटो छोटी करें, फ़ाइल बदलें, JSON साफ़ करें या हिसाब लगाएँ — बिल्कुल मुफ़्त, बिना साइन-अप। लगभग सब कुछ आपके ब्राउज़र में ही चलता है, इसलिए आपकी फ़ाइलें कभी अपलोड नहीं होतीं।",
  "hero.prompt": "आप क्या करना चाहते हैं?",
  "hero.browsePdf": "PDF टूल्स",
  "hero.browseAll": "सभी देखें",
  "hero.askAi": "DO101 AI से पूछें",
  "hero.noUpload": "कोई अपलोड नहीं — फ़ाइलें आपके डिवाइस पर ही रहती हैं",
  "hero.noAccount": "कोई खाता नहीं, कोई वॉटरमार्क नहीं",
  "hero.noLimits": "कोई फ़ाइल सीमा या क्रेडिट नहीं",
  "hero.freeTools": "मुफ़्त टूल · बिना साइन-अप · बिना अपलोड",
  "common.free": "मुफ़्त",
  "common.copy": "कॉपी करें",
  "common.copied": "कॉपी हो गया!",
  "common.download": "डाउनलोड",
  "common.clear": "साफ़ करें",
  "common.reset": "रीसेट",
  "common.loading": "लोड हो रहा है…",
  "footer.tagline": "और करें। आसानी से।",
  "footer.rights": "सर्वाधिकार सुरक्षित।",
  "lang.label": "भाषा",
  "lang.choose": "भाषा चुनें",
  "lang.uiOnly":
    "इंटरफ़ेस का अनुवाद हो चुका है। टूल पेजों का विवरण सही अनुवाद होने तक अंग्रेज़ी में ही रहेगा।",
  "lang.detected": "आपके ब्राउज़र से पहचाना गया",
};

const ne: Messages = {
  "nav.tools": "उपकरणहरू",
  "nav.pdf": "PDF",
  "nav.news": "समाचार",
  "nav.games": "खेलहरू",
  "nav.calculators": "क्याल्कुलेटर",
  "nav.ai": "एआई",
  "nav.about": "हाम्रोबारे",
  "nav.search": "उपकरण खोज्नुहोस्",
  "nav.categories": "वर्गहरू",
  "nav.jumpIn": "यहाँबाट सुरु गर्नुहोस्",
  "nav.seeAll": "सबै उपकरण हेर्नुहोस्",
  "nav.menu": "मेनु खोल्नुहोस्",
  "nav.close": "मेनु बन्द गर्नुहोस्",
  "hero.tagline": "अझ धेरै गर्नुहोस्। सजिलै।",
  "hero.subtitle":
    "PDF जोड्नुहोस्, फोटो सानो बनाउनुहोस्, फाइल परिवर्तन गर्नुहोस्, JSON मिलाउनुहोस् वा हिसाब गर्नुहोस् — पूर्णतया निःशुल्क, दर्ता नगरी। लगभग सबै काम तपाईंकै ब्राउजरमा हुन्छ, त्यसैले फाइल कहिल्यै अपलोड हुँदैन।",
  "hero.prompt": "तपाईं के गर्न चाहनुहुन्छ?",
  "hero.browsePdf": "PDF उपकरण",
  "hero.browseAll": "सबै हेर्नुहोस्",
  "hero.askAi": "DO101 AI लाई सोध्नुहोस्",
  "hero.noUpload": "अपलोड छैन — फाइल तपाईंकै यन्त्रमा रहन्छ",
  "hero.noAccount": "खाता चाहिँदैन, वाटरमार्क छैन",
  "hero.noLimits": "फाइल सीमा वा क्रेडिट छैन",
  "hero.freeTools": "निःशुल्क उपकरण · दर्ता नचाहिने · अपलोड नहुने",
  "common.free": "निःशुल्क",
  "common.copy": "प्रतिलिपि",
  "common.copied": "प्रतिलिपि भयो!",
  "common.download": "डाउनलोड",
  "common.clear": "खाली गर्नुहोस्",
  "common.reset": "रिसेट",
  "common.loading": "लोड हुँदै…",
  "footer.tagline": "अझ धेरै गर्नुहोस्। सजिलै।",
  "footer.rights": "सर्वाधिकार सुरक्षित।",
  "lang.label": "भाषा",
  "lang.choose": "भाषा छान्नुहोस्",
  "lang.uiOnly":
    "इन्टरफेस अनुवाद भइसकेको छ। उपकरण पृष्ठहरूको विवरण राम्ररी अनुवाद नहुँदासम्म अङ्ग्रेजीमै रहनेछ।",
  "lang.detected": "तपाईंको ब्राउजरबाट पत्ता लगाइयो",
};

const zh: Messages = {
  "nav.tools": "工具",
  "nav.pdf": "PDF",
  "nav.news": "资讯",
  "nav.games": "游戏",
  "nav.calculators": "计算器",
  "nav.ai": "AI",
  "nav.about": "关于",
  "nav.search": "搜索工具",
  "nav.categories": "分类",
  "nav.jumpIn": "快速开始",
  "nav.seeAll": "查看全部工具",
  "nav.menu": "打开菜单",
  "nav.close": "关闭菜单",
  "hero.tagline": "做得更多，更简单。",
  "hero.subtitle":
    "合并 PDF、压缩照片、转换文件、格式化 JSON、完成计算 — 完全免费，无需注册。几乎所有处理都在浏览器内完成，文件不会被上传。",
  "hero.prompt": "你想做什么？",
  "hero.browsePdf": "PDF 工具",
  "hero.browseAll": "查看全部",
  "hero.askAi": "问问 DO101 AI",
  "hero.noUpload": "不上传 — 文件保留在你的设备上",
  "hero.noAccount": "无需账号，没有水印",
  "hero.noLimits": "没有文件限制或点数",
  "hero.freeTools": "个免费工具 · 无需注册 · 不上传",
  "common.free": "免费",
  "common.copy": "复制",
  "common.copied": "已复制！",
  "common.download": "下载",
  "common.clear": "清空",
  "common.reset": "重置",
  "common.loading": "加载中…",
  "footer.tagline": "做得更多，更简单。",
  "footer.rights": "保留所有权利。",
  "lang.label": "语言",
  "lang.choose": "选择语言",
  "lang.uiOnly": "界面已翻译。工具页面的说明文字在完成正式翻译前仍为英文。",
  "lang.detected": "根据浏览器设置识别",
};

const ko: Messages = {
  "nav.tools": "도구",
  "nav.pdf": "PDF",
  "nav.news": "뉴스",
  "nav.games": "게임",
  "nav.calculators": "계산기",
  "nav.ai": "AI",
  "nav.about": "소개",
  "nav.search": "도구 검색",
  "nav.categories": "카테고리",
  "nav.jumpIn": "바로 시작하기",
  "nav.seeAll": "모든 도구 보기",
  "nav.menu": "메뉴 열기",
  "nav.close": "메뉴 닫기",
  "hero.tagline": "더 많이, 더 간단하게.",
  "hero.subtitle":
    "PDF 병합, 사진 압축, 파일 변환, JSON 정리, 계산까지 — 가입 없이 모두 무료입니다. 대부분의 처리가 브라우저 안에서 이루어지므로 파일이 업로드되지 않습니다.",
  "hero.prompt": "무엇을 하시겠어요?",
  "hero.browsePdf": "PDF 도구",
  "hero.browseAll": "전체 보기",
  "hero.askAi": "DO101 AI에게 묻기",
  "hero.noUpload": "업로드 없음 — 파일은 기기에 남습니다",
  "hero.noAccount": "계정 불필요, 워터마크 없음",
  "hero.noLimits": "파일 제한이나 크레딧 없음",
  "hero.freeTools": "개의 무료 도구 · 가입 불필요 · 업로드 없음",
  "common.free": "무료",
  "common.copy": "복사",
  "common.copied": "복사됨!",
  "common.download": "다운로드",
  "common.clear": "지우기",
  "common.reset": "초기화",
  "common.loading": "불러오는 중…",
  "footer.tagline": "더 많이, 더 간단하게.",
  "footer.rights": "모든 권리 보유.",
  "lang.label": "언어",
  "lang.choose": "언어 선택",
  "lang.uiOnly": "인터페이스는 번역되었습니다. 도구 페이지 설명은 정식 번역 전까지 영어로 표시됩니다.",
  "lang.detected": "브라우저 설정에서 감지됨",
};

const id: Messages = {
  "nav.tools": "Alat",
  "nav.pdf": "PDF",
  "nav.news": "Berita",
  "nav.games": "Permainan",
  "nav.calculators": "Kalkulator",
  "nav.ai": "AI",
  "nav.about": "Tentang",
  "nav.search": "Cari alat",
  "nav.categories": "Kategori",
  "nav.jumpIn": "Langsung mulai",
  "nav.seeAll": "Lihat semua alat",
  "nav.menu": "Buka menu",
  "nav.close": "Tutup menu",
  "hero.tagline": "Lakukan lebih banyak. Dengan mudah.",
  "hero.subtitle":
    "Gabungkan PDF, kompres foto, konversi berkas, rapikan JSON, atau selesaikan hitungan — gratis, tanpa daftar. Hampir semuanya berjalan di peramban Anda, jadi berkas tidak pernah diunggah.",
  "hero.prompt": "Apa yang ingin Anda lakukan?",
  "hero.browsePdf": "Alat PDF",
  "hero.browseAll": "Lihat semua",
  "hero.askAi": "Tanya DO101 AI",
  "hero.noUpload": "Tanpa unggah — berkas tetap di perangkat Anda",
  "hero.noAccount": "Tanpa akun, tanpa tanda air",
  "hero.noLimits": "Tanpa batas berkas atau kredit",
  "hero.freeTools": "alat gratis · tanpa daftar · tanpa unggah",
  "common.free": "Gratis",
  "common.copy": "Salin",
  "common.copied": "Tersalin!",
  "common.download": "Unduh",
  "common.clear": "Bersihkan",
  "common.reset": "Atur ulang",
  "common.loading": "Memuat…",
  "footer.tagline": "Lakukan lebih banyak. Dengan mudah.",
  "footer.rights": "Seluruh hak cipta dilindungi.",
  "lang.label": "Bahasa",
  "lang.choose": "Pilih bahasa",
  "lang.uiOnly":
    "Antarmuka sudah diterjemahkan. Halaman alat masih berbahasa Inggris sampai diterjemahkan dengan benar.",
  "lang.detected": "Terdeteksi dari peramban Anda",
};

const ar: Messages = {
  "nav.tools": "الأدوات",
  "nav.pdf": "PDF",
  "nav.news": "الأخبار",
  "nav.games": "الألعاب",
  "nav.calculators": "الحاسبات",
  "nav.ai": "الذكاء الاصطناعي",
  "nav.about": "عن الموقع",
  "nav.search": "ابحث عن أداة",
  "nav.categories": "الفئات",
  "nav.jumpIn": "ابدأ مباشرة",
  "nav.seeAll": "عرض كل الأدوات",
  "nav.menu": "فتح القائمة",
  "nav.close": "إغلاق القائمة",
  "hero.tagline": "أنجز أكثر. ببساطة.",
  "hero.subtitle":
    "ادمج ملفات PDF، اضغط الصور، حوّل الملفات، نسّق JSON أو أنجز عملية حسابية — مجانًا وبدون تسجيل. كل شيء تقريبًا يعمل داخل متصفحك، لذا لا تُرفع ملفاتك أبدًا.",
  "hero.prompt": "ماذا تريد أن تفعل؟",
  "hero.browsePdf": "أدوات PDF",
  "hero.browseAll": "عرض الكل",
  "hero.askAi": "اسأل DO101 AI",
  "hero.noUpload": "بدون رفع — تبقى الملفات على جهازك",
  "hero.noAccount": "بدون حساب وبدون علامة مائية",
  "hero.noLimits": "بدون حدود للملفات أو أرصدة",
  "hero.freeTools": "أداة مجانية · بدون تسجيل · بدون رفع",
  "common.free": "مجاني",
  "common.copy": "نسخ",
  "common.copied": "تم النسخ!",
  "common.download": "تنزيل",
  "common.clear": "مسح",
  "common.reset": "إعادة تعيين",
  "common.loading": "جارٍ التحميل…",
  "footer.tagline": "أنجز أكثر. ببساطة.",
  "footer.rights": "جميع الحقوق محفوظة.",
  "lang.label": "اللغة",
  "lang.choose": "اختر لغة",
  "lang.uiOnly":
    "تمت ترجمة الواجهة. أما صفحات الأدوات فما زالت بالإنجليزية إلى أن تُترجم ترجمة صحيحة.",
  "lang.detected": "تم التعرف عليها من متصفحك",
};

const MESSAGES: Record<string, Messages> = { en, ja, es, fr, de, pt, hi, ne, zh, ko, id, ar };

export function getMessages(locale: string): Messages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

export type MessageKey = keyof Messages;
