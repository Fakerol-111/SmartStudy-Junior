import React, { useMemo, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  content: string;
  textColor?: string;
  width?: number;
}

function buildHtml(content: string, textColor: string): string {
  const jsonContent = JSON.stringify(content);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: ${textColor};
      padding: 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .katex { font-size: 1.1em; }
    .katex-display { text-align: center; margin: 8px 0; }
    p { margin: 0 0 8px 0; }
    ul, ol { margin: 0 0 8px 0; padding-left: 24px; }
    li { margin-bottom: 4px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    h1, h2, h3, h4 { margin: 12px 0 8px 0; font-weight: 700; }
    h1 { font-size: 22px; }
    h2 { font-size: 19px; }
    h3 { font-size: 17px; }
    code {
      background: rgba(0,0,0,0.06);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
      font-family: 'Courier New', monospace;
    }
    pre { margin: 0 0 8px 0; }
    pre code {
      display: block;
      padding: 12px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 3px solid ${textColor === '#fff' ? 'rgba(255,255,255,0.4)' : '#ccc'};
      padding-left: 12px;
      margin: 0 0 8px 0;
      opacity: 0.85;
    }
    a { color: ${textColor === '#fff' ? '#add8ff' : '#4A90D9'}; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      var content = ${jsonContent};

      try {
        var html = marked.parse(content);
        var rootEl = document.getElementById('root');
        rootEl.innerHTML = html;

        // Use KaTeX auto-render to handle most delimiter cases robustly
        if (typeof renderMathInElement === 'function') {
          try {
            renderMathInElement(rootEl, {
              delimiters: [
                {left: '\\[', right: '\\]', display: true},
                {left: '\\(', right: '\\)', display: false},
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
              ],
              throwOnError: false,
              strict: false,
              ignoredTags: ['script','noscript','style','textarea','pre','code']
            });
          } catch (e) {}
        } else if (typeof katex !== 'undefined' && typeof katex.renderToString === 'function') {
          // Fallback: try simple replacement for common delimiters
          var text = content
            .replace(/\\\[([\s\S]+?)\\\]/g, function(m, expr){ return katex.renderToString(expr, {displayMode:true,throwOnError:false,strict:false}); })
            .replace(/\\\(([\s\S]+?)\\\)/g, function(m, expr){ return katex.renderToString(expr, {displayMode:false,throwOnError:false,strict:false}); })
            .replace(/\$\$([\s\S]+?)\$\$/g, function(m, expr){ return katex.renderToString(expr, {displayMode:true,throwOnError:false,strict:false}); })
            .replace(/\$([\s\S]+?)\$/g, function(m, expr){ return katex.renderToString(expr, {displayMode:false,throwOnError:false,strict:false}); });
          rootEl.innerHTML = marked.parse(text);
        }
      } catch (e) {
        document.getElementById('root').innerHTML = '<div style="color:#999;font-style:italic;">公式渲染出错</div>';
      }

      // Give the browser a moment to render and then report height
      setTimeout(function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({height: document.body.scrollHeight}));
      }, 60);
    })();
  </script>
</body>
</html>`;
}

export default function MathFormula({ content, textColor = '#1a1a1a', width }: Props) {
  const [webviewHeight, setWebviewHeight] = useState(40);

  const html = useMemo(() => buildHtml(content, textColor), [content, textColor]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.height === 'number' && data.height > 0) {
        setWebviewHeight(data.height);
      }
    } catch {}
  }, []);

  const webStyle = width != null
    ? { height: webviewHeight, width }
    : { height: webviewHeight, width: '100%' as const };

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={webStyle}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
