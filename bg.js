"use strict";

const cli = require('cli');
const request = require('request');
const util = require('util');

class BGFetch {
    constructor(options) {
        this.options = options;
    }

    filter(product) {
        if (product.products_left == 0 && this.options.showSold == false) {
            return false
        }

        if (product.discount < this.options.discount) {
            return false;
        }


        return true;
    }

    render(product) {
        // console.log(product);
        console.log('%s [%s - %s%] : %s', product.productinfo.products_name, product.format_specials_price, product.discount, product.productinfo.url);
    }

    sortBy(list, column, asc) {
        asc = asc === undefined ? true : asc;

        return list.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            let result = 0;

            if (valA < valB) {
                result = -1;
            } else if (valA > valB) {
                result = 1;
            }

            return result * (asc ? 1 : -1);
        });
    }

    renderAll(products) {
        let list = this.sortBy(products, this.options.sortBy, this.options.sortAsc);
        for (let product of list) {
            this.render(product);
        }
    }

    filterList(products) {
        let filtered = [];
        for (let pid in products) {
            let product = products[pid];

            if (this.filter(product)) {
                filtered.push(product);
                // this.render(product);
            }
        }

        return filtered;
    }

    fetchPage(pageId, cb) {
        let url = util.format(this.options.url, pageId, this.options.category);
        request(url, (error, response, body) => {
            if(error) {
                return cb(error);
            }

            if (response.statusCode != 200) {
                return new Error('HTTP error: ' + response.statusCode);
            }

            try {
                let data = JSON.parse(body);

                let list = this.filterList(data.products);

                if (this.options.pageLimit > 0 && data.pageInfo.page >= this.options.pageLimit) {
                    cb(null, list);
                } else if (data.pageInfo.page < data.pageInfo.totalPage) {
                    return this.fetchPage(data.pageInfo.page +1, (err, list2) => {
                        cb(err, list.concat(list2));
                    });
                } else {
                    cb(null, list);
                }
            } catch(e) {
                return cb(e);
            }
        })
    }

    fetchAll(cb) {
        this.fetchPage(1, cb);
    }
}

cli.parse({
    url: ['u', 'Url template', 'string', 'https://www.banggood.com/index.php?com=deals&t=getFlashDealsCateProductList&page=%d&category_id=%d'],
    category: ['c', 'Category id', 'number', 0],
    discount: ['d', 'Minimal discount to be included in list', 'number', 30],
    pageLimit: ['l', 'Limit of pages to be loaded (0 = unlimited)', 'number', 0],
    showSold: ['x', 'Show also sold items', 'boolean', false],
    sortBy: ['s', 'Sort by column', 'string', 'specials_new_products_price'],
    sortAsc: ['a', 'Sort ASC (true) or DESC (false)', 'boolean', false],
});

cli.main((args, options) => {

    console.log(options);

    let fetch = new BGFetch(options);
    fetch.fetchAll((error, list) => {
        if (error) {
            return console.error('Fetch error: ', error);
        }

        console.log('Fetch done. Found %d matching items.', list.length);
        fetch.renderAll(list);
    });

});

