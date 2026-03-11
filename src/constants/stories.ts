export interface Story {
  id: string;
  title: string;
  titleEn: string;
  paragraphs: string[];
}

function splitIntoChunks(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const STORIES: Record<string, Story[]> = {
  es: [
    {
      id: 'cafe',
      title: 'En el café',
      titleEn: 'At the café',
      paragraphs: splitIntoChunks(
        'Hola, buenos días. Quiero un café con leche, por favor. ¿Tiene pasteles? Sí, tenemos croissants y magdalenas. Perfecto, un croissant también. ¿Algo más? No, eso es todo. Gracias. Son cinco euros. Aquí tiene. Muchas gracias. ¡Hasta luego!'
      ),
    },
    {
      id: 'parque',
      title: 'Un paseo por el parque',
      titleEn: 'A walk in the park',
      paragraphs: splitIntoChunks(
        'Hoy hace buen tiempo. El sol brilla y los pájaros cantan. Voy a dar un paseo por el parque. Hay muchas flores y árboles verdes. Los niños juegan en el columpio. Una mujer lee un libro en el banco. Es un día muy tranquilo y bonito.'
      ),
    },
    {
      id: 'mercado',
      title: 'En el mercado',
      titleEn: 'At the market',
      paragraphs: splitIntoChunks(
        'Buenos días. ¿Cuánto cuestan las manzanas? Dos euros el kilo. ¿Y las naranjas? Tres euros. Voy a llevar un kilo de cada una. ¿Algo más? Sí, una barra de pan. Son siete euros en total. Aquí tiene. Gracias. ¡Hasta pronto!'
      ),
    },
  ],
  fr: [
    {
      id: 'cafe',
      title: 'Au café',
      titleEn: 'At the café',
      paragraphs: splitIntoChunks(
        "Bonjour. Je voudrais un café au lait, s'il vous plaît. Avez-vous des pâtisseries? Oui, nous avons des croissants et des madeleines. Parfait, un croissant aussi. Autre chose? Non, c'est tout. Merci. C'est cinq euros. Voici. Merci beaucoup. Au revoir!"
      ),
    },
    {
      id: 'parc',
      title: 'Une promenade au parc',
      titleEn: 'A walk in the park',
      paragraphs: splitIntoChunks(
        "Il fait beau aujourd'hui. Le soleil brille et les oiseaux chantent. Je vais faire une promenade au parc. Il y a beaucoup de fleurs et d'arbres verts. Les enfants jouent sur les balançoires. Une femme lit un livre sur le banc. C'est une journée très calme et belle."
      ),
    },
    {
      id: 'marche',
      title: 'Au marché',
      titleEn: 'At the market',
      paragraphs: splitIntoChunks(
        "Bonjour. Combien coûtent les pommes? Deux euros le kilo. Et les oranges? Trois euros. Je vais prendre un kilo de chaque. Autre chose? Oui, une baguette. Ça fait sept euros en tout. Voici. Merci. À bientôt!"
      ),
    },
  ],
  it: [
    {
      id: 'caffe',
      title: 'Al bar',
      titleEn: 'At the café',
      paragraphs: splitIntoChunks(
        'Buongiorno. Vorrei un caffè latte, per favore. Avete dolci? Sì, abbiamo cornetti e madeleine. Perfetto, anche un cornetto. Altro? No, è tutto. Grazie. Sono cinque euro. Ecco. Grazie mille. Arrivederci!'
      ),
    },
    {
      id: 'parco',
      title: 'Una passeggiata nel parco',
      titleEn: 'A walk in the park',
      paragraphs: splitIntoChunks(
        "Oggi fa bel tempo. Il sole splende e gli uccelli cantano. Vado a fare una passeggiata nel parco. Ci sono molti fiori e alberi verdi. I bambini giocano sull'altalena. Una donna legge un libro sulla panchina. È una giornata molto tranquilla e bella."
      ),
    },
    {
      id: 'mercato',
      title: 'Al mercato',
      titleEn: 'At the market',
      paragraphs: splitIntoChunks(
        'Buongiorno. Quanto costano le mele? Due euro al chilo. E le arance? Tre euro. Prendo un chilo di ciascuna. Altro? Sì, una pagnotta. Sono sette euro in totale. Ecco. Grazie. A presto!'
      ),
    },
  ],
  en: [
    {
      id: 'cafe',
      title: 'At the café',
      titleEn: 'At the café',
      paragraphs: splitIntoChunks(
        'Hello, good morning. I would like a latte, please. Do you have pastries? Yes, we have croissants and muffins. Perfect, a croissant too. Anything else? No, that is all. Thank you. That is five euros. Here you go. Thank you very much. Goodbye!'
      ),
    },
    {
      id: 'park',
      title: 'A walk in the park',
      titleEn: 'A walk in the park',
      paragraphs: splitIntoChunks(
        'The weather is nice today. The sun is shining and the birds are singing. I am going for a walk in the park. There are many flowers and green trees. The children play on the swings. A woman reads a book on the bench. It is a very calm and beautiful day.'
      ),
    },
    {
      id: 'market',
      title: 'At the market',
      titleEn: 'At the market',
      paragraphs: splitIntoChunks(
        'Good morning. How much do the apples cost? Two euros per kilo. And the oranges? Three euros. I will take a kilo of each. Anything else? Yes, a loaf of bread. That is seven euros in total. Here you go. Thank you. See you soon!'
      ),
    },
  ],
};

export function getStoriesForLanguage(lang: string): Story[] {
  return STORIES[lang] ?? STORIES.es;
}
