/*!
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fetch from 'cross-fetch';
import { Response } from 'express';
import { getLinkPreview } from 'link-preview-js';
import {
  Controller,
  Get,
  HeaderParam,
  QueryParam,
  Res,
} from 'routing-controllers';

import { HttpException } from '../exceptions/HttpException';
import { encodeToPng } from '../utils/encodeToPng';

@Controller('/v1/link-preview')
export class LinkPreviewController {
  protected async fetchLinkPreviewData(url: string, acceptLanguage?: string) {
    acceptLanguage = acceptLanguage || 'en-US,en';

    const preview = await getLinkPreview(url, {
      headers: {
        'Accept-Language': acceptLanguage,
      },
    });

    if (!preview || !('title' in preview)) {
      return null;
    }

    return {
      url: preview.url,
      title: preview.title,
      description: preview.description,
      mediaType: preview.mediaType,
      contentType: preview.contentType,
      image: preview.images[0] || preview.favicons[0],
    };
  }

  @Get('/fetch-data.json')
  async fetchJson(
    @QueryParam('url') url: string,
    @HeaderParam('Accept-Language') acceptLanguage?: string
  ) {
    const preview = await this.fetchLinkPreviewData(url, acceptLanguage);

    if (!preview) {
      throw new HttpException(404, `Preview link not found for "${url}"`);
    }

    return preview;
  }

  @Get('/fetch-data.png')
  async fetchPng(
    @QueryParam('url') url: string,
    @Res() response: Response,
    @HeaderParam('Accept-Language') acceptLanguage?: string
  ) {
    const preview = await this.fetchJson(url, acceptLanguage);

    const buffer = encodeToPng(JSON.stringify(preview));

    response.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
    });

    return response.end(buffer);
  }

  @Get('/download-image')
  async downloadImage(
    @QueryParam('url') url: string,
    @Res() response: Response
  ) {
    const head = await fetch(url, {
      method: 'HEAD',
    });

    if (!head.ok) {
      throw new HttpException(404, `URL "${url}" was not found`);
    }

    const mimeType =
      head.headers.get('content-type') || 'application/octet-stream';

    if (!/^image\//.test(mimeType)) {
      throw new HttpException(
        400,
        `The content of "${url}" is not an image, current mime type: "${mimeType}"`
      );
    }

    const data = await fetch(url);

    if (!data.ok) {
      throw new HttpException(404, `image not found for "${url}"`);
    }

    const arrayBuffer = await data.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const headers: { [key: string]: string } = {};
    if (data.headers.has('Content-Type')) {
      headers['Content-Type'] = data.headers.get('Content-Type')!;
    }

    response.writeHead(200, {
      'Content-Length': buffer.length,
      ...headers,
    });

    return response.end(buffer);
  }
}
