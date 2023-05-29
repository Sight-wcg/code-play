layui.use(async () => {
  const { jquery: $, layer } = layui;

  const libTypesUrl = './layui.d.ts';
  const libUri = 'ts:filename/layui.d.ts';
  const libSource = await (await fetch(libTypesUrl)).text();
  const snippets = await (await fetch('./snippets.json')).json(); //代码片段来自 https://marketplace.visualstudio.com/items?itemName=PFinal-nc.layui-snippets-pfinal

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    checkJs: true,
    allowJs: true,
  });

  monaco.languages.typescript.javascriptDefaults.addExtraLib(libSource, libUri);

  monaco.languages.registerCompletionItemProvider('html', {
    provideCompletionItems: function (model, position) {
      var word = model.getWordUntilPosition(position);
      var range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: getSuggestions(range),
      };
    },
  });

  function getSuggestions(range) {
    return Object.values(snippets).map((v) => {
      return {
        label: v.prefix,
        documentation: v.description,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: v.body,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range,
      };
    });
  }

  const createEditor = function (id, options) {
    options = {
      language: 'html',
      wordWrap: 'on', // 代码超出换行
      theme: 'vs-light', // 主题
      minimap: {
        enabled: false,
      },
      automaticLayout: true,
      ...options,
    };

    return monaco.editor.create(document.getElementById(id), options);
  };

  const editorJs = createEditor('code-edit-javascript', { language: 'javascript' });
  const editorHtml = createEditor('code-edit-html', { language: 'html' });

  const assembleHtml = function (head, body) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  ${head}
</head>
<body>
  ${body}
<\/body>
<\/html>`.trim();
  };

  const run = function () {
    let head = `
<title>预览<\/title>
<style type="text/css">
<\/style>
`.trim();
    let body = `
  ${editorHtml.getValue()}
<script src="./lib/eruda/eruda.js"><\/script>
<script>
try {
  eruda.init();
  ${editorJs.getValue()}
} catch (err) {
  console.error(err)
}
<\/script>
`.trim();

    document.querySelector('#code-preview').srcdoc = assembleHtml(head, body);
    history.replaceState(
      {},
      '',
      serialize({
        code: {
          javascript: { content: editorJs.getValue() },
          html: { content: editorHtml.getValue() },
        },
      })
    );
  };

  let hash = location.hash.slice(1);
  if (hash) {
    var data = JSON.parse(atou(hash));
    editorHtml.setValue(data.code.html.content);
    editorJs.setValue(data.code.javascript.content);
  } else {
    editorHtml.setValue(
      assembleHtml(
        '<link href="//unpkg.com/layui@2.8.3/dist/css/layui.css" rel="stylesheet">\n<style>body{padding: 20px;}</style>',
        `<button class="layui-btn">按钮</button>

<script src="//unpkg.com/layui@2.8.3/dist/layui.js"></script>`.trim()
      )
    );

    editorJs.setValue(
      `
layui.use(function(){
  var layer = layui.layer;

  layer.msg('layui version' + layui.v)
})`.trim()
    );
  }

  run();

  $('#btn-reset').on('click', function () {
    reset();
  });

  $('#btn-share').on('click', function () {
    copyLink();
  });

  // 监听编辑事件
  editorJs.onDidChangeModelContent(
    debounce(() => {
      run();
    }, 1000)
  );

  // 监听编辑事件
  editorHtml.onDidChangeModelContent(
    debounce(() => {
      run();
    }, 1000)
  );

  async function copyLink() {
    await navigator.clipboard.writeText(location.href);

    layer.msg('分享链接已复制到剪贴板', {
      icon: 1,
      offset: '5%',
      anim: 'slideDown',
      isOutAnim: false,
    });
  }

  function reset() {
    history.replaceState({}, '', '#');
    location.reload();
  }

  function serialize(code) {
    return '#' + utoa(JSON.stringify(code));
  }

  function debounce(fn, n = 100) {
    let handle;
    return (...args) => {
      if (handle) clearTimeout(handle);
      handle = setTimeout(() => {
        fn(...args);
      }, n);
    };
  }

  function utoa(data) {
    const buffer = fflate.strToU8(data);
    const zipped = fflate.zlibSync(buffer, { level: 9 });
    const binary = fflate.strFromU8(zipped, true);
    return btoa(binary);
  }

  function atou(base64) {
    const binary = atob(base64);

    // zlib header (x78), level 9 (xDA)
    if (binary.startsWith('\x78\xDA')) {
      const buffer = fflate.strToU8(binary, true);
      const unzipped = fflate.unzlibSync(buffer);
      return fflate.strFromU8(unzipped);
    }

    // old unicode hacks for backward compatibility
    // https://base64.guru/developers/javascript/examples/unicode-strings
    return decodeURIComponent(escape(binary));
  }
});
