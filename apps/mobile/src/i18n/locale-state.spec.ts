/**
 * locale-state.spec.ts — la langue lisible HORS React.
 * =====================================================
 * Le client API envoie `x-locale` à chaque requête : il doit dire la MÊME
 * langue que celle affichée à l'écran, préférence du compte comprise — c'est
 * elle qui décide de la langue des e-mails sans compte et des messages du
 * serveur. La liste des langues, elle, n'est PAS ici : elle vit uniquement
 * dans `@packages/api-contracts/locale` (D44), et c'est `resolveLocale` qui
 * normalise ce que l'appareil annonce.
 */
type LocaleModule = typeof import('@/i18n/locale-state');

function loadLocaleState(languageTags: string[]): LocaleModule {
  let mod: LocaleModule = {} as LocaleModule;
  jest.isolateModules(() => {
    jest.doMock('expo-localization', () => ({
      getLocales: () => languageTags.map((languageTag) => ({ languageTag })),
    }));
    mod = require('@/i18n/locale-state') as LocaleModule;
  });
  return mod;
}

beforeEach(() => {
  jest.resetModules();
});

describe('deviceLocale — ce que l’appareil annonce, normalisé', () => {
  it('reconnaît une étiquette régionale (« fr-CG » reste du français)', () => {
    expect(loadLocaleState(['fr-CG']).deviceLocale()).toBe('fr');
    expect(loadLocaleState(['en-GB']).deviceLocale()).toBe('en');
  });

  it('ne garde que la PREMIÈRE langue de l’appareil — c’est la préférée', () => {
    expect(loadLocaleState(['en-US', 'fr-FR']).deviceLocale()).toBe('en');
  });

  it('une langue non supportée retombe sur le défaut, jamais sur une erreur', () => {
    expect(loadLocaleState(['ja-JP']).deviceLocale()).toBe('fr');
  });

  it('un appareil sans langue déclarée ne fait pas tomber l’app', () => {
    expect(loadLocaleState([]).deviceLocale()).toBe('fr');
  });
});

describe('currentLocale — ce que l’en-tête x-locale envoie', () => {
  it('part de l’appareil tant que le provider n’a rien posé', () => {
    expect(loadLocaleState(['en-US']).currentLocale()).toBe('en');
  });

  it('suit la langue AFFICHÉE dès que le provider la pose (préférence du compte)', () => {
    const mod = loadLocaleState(['en-US']);
    mod.setCurrentLocale('fr');
    expect(mod.currentLocale()).toBe('fr');
  });

  it('un changement de langue en cours de session est pris en compte tout de suite', () => {
    const mod = loadLocaleState(['fr-FR']);
    mod.setCurrentLocale('en');
    expect(mod.currentLocale()).toBe('en');
    mod.setCurrentLocale('fr');
    expect(mod.currentLocale()).toBe('fr');
  });
});
