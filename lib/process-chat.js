/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var marked    = require('gitter-marked');
var highlight = require('highlight.js');
var _         = require('underscore');
var util      = require('util');
var katex     = require('katex');
var matcher   = require('./github-url-matcher');

var options = { gfm: true, tables: true, sanitize: true, breaks: true, linkify: true, skipComments: true };

var lexer = new marked.Lexer(options);

var JAVA =  'java';
var SCRIPT = 'script:';
var scriptUrl = JAVA + SCRIPT;
var dataUrl = 'data:';
var httpUrl = 'http://';
var httpsUrl = 'https://';
var noProtocolUrl = '//';

highlight.configure({classPrefix: ''});


function checkForIllegalUrl(href) {
  if(!href) return "";

  href = href.trim();
  var hrefLower = href.toLowerCase();

  if(hrefLower.indexOf(scriptUrl) === 0 || hrefLower.indexOf(dataUrl) === 0) {
    /* Rickroll the script kiddies */
    return "http://goo.gl/a7HIYr";
  }

  if(hrefLower.indexOf(httpUrl) !== 0 && hrefLower.indexOf(httpsUrl) !== 0 && hrefLower.indexOf(noProtocolUrl) !== 0)  {
    return httpUrl + href;
  }

  return href;
}

function getRenderer(renderContext) {

  var renderer = new marked.Renderer();

  // Highlight code blocks
  renderer.code = function(code, lang) {
    lang = (lang + '').toLowerCase();

    if (highlight.listLanguages().indexOf(lang) !== -1)
      return util.format('<pre><code class="%s">%s</code></pre>', lang, highlight.highlight(lang, code).value);

    return util.format('<pre><code>%s</code></pre>', highlight.highlightAuto(code).value);
  };

  // Highlight code blocks
  renderer.latex = function(latexCode) {
    try {
      return katex.renderToString(latexCode);
    } catch(e) {
      return util.format('<pre><code>%s: %s</code></pre>', e.message, latexCode);
    }
  };

  // Extract urls mentions and issues from paragraphs
  renderer.paragraph = function(text) {
    renderContext.paragraphCount++;
    return util.format('<p>%s</p>', text);
  };

  renderer.issue = function(repo, issue, text) {
    renderContext.issues.push({
      number: issue,
      repo: repo ? repo : undefined
    });

    var out = '<span data-link-type="issue" data-issue="' + issue + '"';
    if(repo) {
      out += util.format(' data-issue-repo="%s"', repo);
    }
    out += ' class="issue">' + text + '</span>';
    return out;
  };

  renderer.commit = function(repo, sha) {
    var text = repo+'@'+sha.substring(0, 7);
    var out = '<span data-link-type="commit" ' +
              'data-commit-sha="' + sha + '" ' +
              'data-commit-repo="' + repo + '" ' +
              'class="commit">' + text + '</span>';
    return out;
  };

  renderer.link = function(href, title, text) {
    href = checkForIllegalUrl(href);
    var githubData = matcher(href);
    if(githubData) {
      return renderer[githubData.type](githubData.repo, githubData.id, githubData.text);
    } else {
      renderContext.urls.push({ url: href });
      return util.format('<a href="%s" rel="nofollow" target="_blank" class="link">%s</a>', href, text);
    }
  };

  renderer.image = function(href, title, text) {
    href = checkForIllegalUrl(href);
    renderContext.urls.push({ url: href });
    return util.format('<img src="%s" alt="%s" rel="nofollow">', href, text);

  };

  renderer.mention = function(href, title, text) {
    var screenName = text.charAt(0) === '@' ? text.substring(1) : text;
    renderContext.mentions.push({ screenName: screenName });
    return util.format('<span data-link-type="mention" data-screen-name="%s" class="mention">%s</span>', screenName, text);
  };

  renderer.groupmention = function(name, text) {
    renderContext.mentions.push({ screenName: name, group: true });
    return util.format('<span data-link-type="groupmention" data-group-name="%s" class="groupmention">%s</span>', name, text);
  };

  renderer.email = function(href, title, text) {
    checkForIllegalUrl(href);

    renderContext.urls.push({ url: href });
    return util.format('<a href="%s" rel="nofollow">%s</a>', href, text);
  };

  renderer.heading = function(text, level/*, raw */) {
    return '<h' +
      level +
      '>' +
      text +
      '</h' +
      level +
      '>\n';
  };

  return renderer;
}




module.exports = exports = function processChat(text) {
  var renderContext = {
    urls: [],
    mentions: [],
    issues: [],
    paragraphCount: 0
  };

  var renderer = getRenderer(renderContext);
  var tokens = lexer.lex(text);
  var parser = new marked.Parser(_.extend({ renderer: renderer }, options));
  var html = parser.parse(tokens);
  if(renderContext.paragraphCount === 1) {
    html = html.replace(/<\/?p>/g,'');
  }

  return {
    text: text,
    html: html,
    urls: renderContext.urls,
    mentions: renderContext.mentions,
    issues: renderContext.issues
  };
};