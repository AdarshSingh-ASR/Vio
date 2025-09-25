export interface ThemeOption {
    name: string;
    value: string;
    preview: {
      background: string;
      foreground: string;
      primary: string;
      accent: string;
    };
  }
  
  export const themes: ThemeOption[] = [
    {
      name: "Light",
      value: "light",
      preview: {
        background: "rgb(255, 255, 255)",
        foreground: "rgb(10, 10, 10)",
        primary: "rgb(59, 130, 246)",
        accent: "rgb(243, 244, 246)",
      }
    },
    {
      name: "Dark",
      value: "dark",
      preview: {
        background: "rgb(10, 10, 10)",
        foreground: "rgb(250, 250, 250)",
        primary: "rgb(59, 130, 246)",
        accent: "rgb(38, 38, 38)",
      }
    },
    {
      name: "Notion Light",
      value: "notion-light",
      preview: {
        background: "rgb(255, 255, 255)",
        foreground: "rgb(55, 53, 47)",
        primary: "rgb(35, 130, 252)",
        accent: "rgb(241, 241, 239)",
      }
    },
    {
      name: "Notion Dark",
      value: "notion-dark",
      preview: {
        background: "rgb(25, 25, 25)",
        foreground: "rgb(235, 235, 235)",
        primary: "rgb(38, 132, 255)",
        accent: "rgb(48, 48, 48)",
      }
    },
    {
      name: "Midnight",
      value: "midnight",
      preview: {
        background: "rgb(9, 14, 44)",
        foreground: "rgb(237, 240, 255)",
        primary: "rgb(59, 130, 246)",
        accent: "rgb(30, 41, 59)",
      }
    },
    {
      name: "Forest",
      value: "forest",
      preview: {
        background: "rgb(26, 31, 28)",
        foreground: "rgb(211, 216, 212)",
        primary: "rgb(44, 119, 68)",
        accent: "rgb(58, 77, 63)",
      }
    },
    {
      name: "Autumn",
      value: "autumn",
      preview: {
        background: "rgb(249, 245, 240)",
        foreground: "rgb(75, 56, 50)",
        primary: "rgb(224, 122, 95)",
        accent: "rgb(242, 208, 164)",
      }
    },
  ];
  
  export function getTheme(id: string): ThemeOption {
    return themes.find(theme => theme.value === id) || themes[0];
  }