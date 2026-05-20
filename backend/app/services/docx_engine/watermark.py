"""Watermark module.

Adds a semi-transparent diagonal "仅供投标使用" watermark across every page
by manipulating the document header XML directly.
"""

from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
from docx.shared import Pt

from .styles import FONT_BODY, COLOR_WATERMARK


def add_watermark(doc, text: str = '仅供投标使用') -> None:
    """Add a diagonal watermark to all pages of the document.

    The watermark is placed in the default-section header as a VML shape
    styled to appear behind the content with semi-transparent grey text.

    Args:
        doc: python-docx Document object.
        text: Watermark text (default: '仅供投标使用').
    """
    section = doc.sections[0]
    header = section.header
    header.is_linked_to_previous = False

    # Build a paragraph containing the watermark VML shape
    _add_watermark_paragraph(header, text)


def _add_watermark_paragraph(header, text: str):
    """Add a watermark paragraph to the document header."""
    paragraph = header.add_paragraph()

    # The watermark is a WordprocessingML picture (w:pict) containing a VML shape.
    # The shape is positioned absolutely across the page.
    watermark_xml = _build_watermark_xml(text)
    run = paragraph.add_run()
    run._r.append(watermark_xml)


def _build_watermark_xml(text: str):
    """Construct the raw XML for the watermark VML shape.

    Returns a w:pict element as an lxml Element.
    """
    # We mimic the format that Word produces for text watermarks.
    # The shape is rotated -45 degrees and placed in the centre of the page,
    # with a semi-transparent colour.
    pict_xml = f'''<w:pict {nsdecls("w")}>
  <v:shape id="PowerPlusWaterMarkObject"
           style="position:absolute;left:0;top:0;width:500pt;height:120pt;rotation:-45;
                  mso-position-horizontal:center;mso-position-vertical:center;
                  mso-width-relative:page;mso-height-relative:page;"
           fillcolor="{COLOR_WATERMARK}"
           stroked="f"
           coordorigin="0,0"
           coordsize="21600,21600"
           xmlns:v="urn:schemas-microsoft-com:vml"
           xmlns:o="urn:schemas-microsoft-com:office:office">
    <v:fill opacity=".5"/>
    <v:textbox style="mso-fit-shape-to-text:t">
      <w:txbxContent {nsdecls("w")}>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="{FONT_BODY}" w:eastAsia="{FONT_BODY}" w:hAnsi="{FONT_BODY}"/>
              <w:sz w:val="72"/>
              <w:color w:val="808080"/>
            </w:rPr>
            <w:t xml:space="preserve">{text}</w:t>
          </w:r>
        </w:p>
      </w:txbxContent>
    </v:textbox>
  </v:shape>
</w:pict>'''

    return parse_xml(pict_xml)
